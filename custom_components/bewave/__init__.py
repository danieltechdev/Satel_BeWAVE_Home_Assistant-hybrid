"""BE WAVE (Satel) integration for Home Assistant."""
from __future__ import annotations
import logging
import threading
import time
from datetime import timedelta

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .const import (DOMAIN, CONF_LOGIN, CONF_PASSWORD, CONF_HOST, CONF_SERIAL,
                    CONF_DEVICE_UUID, CONF_MODE, DEFAULT_MODE, SCAN_INTERVAL_SECONDS)
from . import bewave_client as proto

_LOGGER = logging.getLogger(__name__)
PLATFORMS = ["alarm_control_panel", "switch", "binary_sensor", "sensor"]


CARD_URL = "/bewave/bewave-card.js"
CARD_VERSION = "0.6.1"


async def _async_register_card(hass: HomeAssistant) -> None:
    """Serve the Lovelace card and load it in the frontend (best effort)."""
    if hass.data.get(f"{DOMAIN}_card_registered"):
        return
    hass.data[f"{DOMAIN}_card_registered"] = True
    try:
        from pathlib import Path
        path = str(Path(__file__).parent / "www" / "bewave-card.js")
        try:
            from homeassistant.components.http import StaticPathConfig
            await hass.http.async_register_static_paths(
                [StaticPathConfig(CARD_URL, path, False)])
        except ImportError:                      # HA < 2024.7
            hass.http.register_static_path(CARD_URL, path, False)
        from homeassistant.components.frontend import add_extra_js_url
        add_extra_js_url(hass, f"{CARD_URL}?v={CARD_VERSION}")
    except Exception as err:                     # never block the integration
        _LOGGER.warning("BE WAVE: could not register the Lovelace card (%s); add "
                        "%s as a Dashboard resource manually", err, CARD_URL)


class BeWaveHub:
    """Owns a persistent local connection; thread-safe for executor jobs."""

    def __init__(self, host, login, password, device_uuid, serial=None, mode="defau"):
        self.host = host
        self.mode = mode
        self._lock = threading.Lock()
        self.client = proto.BeWaveClient(login, password, device_uuid)
        if serial:
            self.client.serial = serial
        self.conn: proto.LocalConnection | None = None
        self._registered = False
        self._empty = 0                        # consecutive polls with no data
        self.state: str | None = None          # armed_away | disarmed | arming | None
        self._arming_until = 0.0               # exit delay: HYBRID confirms arming late
        self._mode_arming: dict[str, float] = {}   # per-mode exit-delay deadlines
        self.code_fails = 0                    # wrong-PIN counter (anti brute force)
        self.code_locked_until = 0.0
        self.modes: dict[str, dict] = {}       # arm modes read from the hub
        self.flags = {"led": None, "grade2": None, "satel": None}
        self.info = {"power": None, "stor_free": None, "stor_total": None,
                     "network": None, "firmware": None}
        self.dev_names: dict[int, dict] = {}   # config: name/room/model/sysnum/bypass
        self.dev_state: dict[int, dict] = {}   # live telemetry

    def _ensure(self):
        if self.conn is not None:
            return
        self.conn = proto.LocalConnection(self.host, self.client)
        self.conn.connect_and_signin()         # subscribes + registers
        if not self._registered:
            # firmware 1.04+: a brand-new self-generated device id gets FULL access
            # (state + control) only AFTER it registers, the hub processes the
            # registration (and the user approves the "new device" on their phone if
            # prompted), and we then reconnect. The wait is essential — reconnecting
            # immediately leaves the device read-only (it can read state but the hub
            # ignores its arm/disarm commands). Proven with bewave_ownuuid.py.
            self._registered = True
            self.conn.close()
            self.conn = None
            time.sleep(8)
            self.conn = proto.LocalConnection(self.host, self.client)
            self.conn.connect_and_signin()
        _LOGGER.info("BE WAVE: signed in to %s (serial=%s)", self.host, self.client.serial)

    def _reconnect(self):
        """Drop a dead/stale session and sign in again (caller holds the lock)."""
        try:
            if self.conn:
                self.conn.close()
        except Exception:
            pass
        self.conn = None
        self._empty = 0
        self._ensure()

    def poll(self):
        with self._lock:
            try:
                self._ensure()
                self.conn.refresh()            # light re-subscribe (f88 + f26)
                msgs = self.conn.read_messages(1.5)
                if msgs:
                    self._empty = 0
                    self._update_from(msgs)
                else:
                    # A healthy session answers a refresh with telemetry; several
                    # silent polls in a row mean the hub dropped us -> reconnect.
                    self._empty += 1
                    if self._empty >= 3:
                        _LOGGER.info("BE WAVE: stale session, reconnecting")
                        self._reconnect()
                return {"state": self.state}
            except Exception as err:
                try:
                    if self.conn: self.conn.close()
                finally:
                    self.conn = None
                self._empty = 0
                raise UpdateFailed(f"BE WAVE poll failed: {err}") from err

    def _update_from(self, msgs):
        for _fd, pt in msgs:
            if not pt:
                continue
            st = proto.armed_state(pt)
            if st is not None:
                if st:
                    self.state = "armed_away"
                    self._arming_until = 0.0
                elif time.time() < self._arming_until:
                    self.state = "arming"      # exit delay still running
                else:
                    self.state = "disarmed"
            md = proto.alarm_modes(pt)
            if md:
                self.modes = md
            fl = proto.system_status(pt)
            if fl is not None:
                self.flags.update(fl)
            hi = proto.hub_info(pt)
            if hi is not None:
                self.info.update({"power": hi["power"], "stor_free": hi["stor_free"],
                                  "stor_total": hi["stor_total"]})
                if hi.get("firmware"):
                    self.info["firmware"] = hi["firmware"]
            net = proto.network_active(pt)
            if net is not None:
                self.info["network"] = net
            cfg = proto.parse_config_devices(pt)
            for did, d in cfg.items():
                self.dev_names[did] = {k: d[k] for k in ("name", "room", "type", "model", "sysnum", "bypass")}
                ds = self.dev_state.setdefault(did, {})
                for k in ("signal", "battery", "state", "temp", "type", "volt"):
                    if d.get(k) is not None:
                        ds[k] = d[k]
            for did, d in proto.parse_telemetry(pt).items():
                self.dev_state.setdefault(did, {}).update({k: v for k, v in d.items() if v is not None})
        # while armed, a currently-violated contact/motion zone means the alarm has
        # been tripped -> show the panel as "triggered" (sounding)
        if self.state == "armed_away":
            for _did, _st in self.dev_state.items():
                _typ = self.dev_names.get(_did, {}).get("type") or _st.get("type")
                if _st.get("state") == 1 and proto.DEV_TYPES.get(_typ) in ("contact", "motion"):
                    self.state = "triggered"
                    break

    # devices that report an armed flag but are not part of full arming
    # (remote/keyfob APT-210, tamper/siren sabotage input)
    _NON_ARMABLE_MODELS = {"APT-210"}
    _NON_ARMABLE_TYPES = {0x10002, 66819}

    def _armable_ids(self):
        out = []
        for did, st in self.dev_state.items():
            if st.get("armed") is None:
                continue
            nm = self.dev_names.get(did, {})
            if nm.get("model") in self._NON_ARMABLE_MODELS:
                continue
            if (nm.get("type") or st.get("type")) in self._NON_ARMABLE_TYPES:
                continue
            out.append(did)
        return out

    def mode_state(self, mode):
        """State of one arm mode, derived from the 'armed' flag (f20) of the devices
        that belong to the mode. Falls back to the global state if unknown."""
        info = self.modes.get(mode) or {}
        ids = info.get("device_ids") or []
        if not ids and info.get("default"):
            ids = self._armable_ids()          # full arming ("pelne czuwanie")
        flags = [self.dev_state.get(i, {}).get("armed") for i in ids]
        if not ids or any(f is None for f in flags):
            return self.state
        if all(f in (1, 2) for f in flags):
            self._mode_arming.pop(mode, None)
            return "armed_away"
        if time.time() < self._mode_arming.get(mode, 0.0):
            return "arming"
        return "disarmed"

    def devices(self):
        out = []
        for did in set(self.dev_names) | set(self.dev_state):
            nm = self.dev_names.get(did, {}); st = self.dev_state.get(did, {})
            typ = nm.get("type") or st.get("type")
            out.append({"id": did, "name": nm.get("name") or f"#{did}",
                        "room": nm.get("room"), "model": nm.get("model"),
                        "sysnum": nm.get("sysnum"), "bypass": nm.get("bypass"),
                        "cat": proto.DEV_TYPES.get(typ, "device"),
                        "state": st.get("state"), "temp": st.get("temp"),
                        "battery": st.get("battery"), "signal": st.get("signal"),
                        "volt": st.get("volt")})
        return out

    def _command(self, send, verify=None):
        """Run a command on a live session, verifying + retrying on a fresh
        connection if the socket was stale (commands are lost on a dead socket).
        Caller holds the lock."""
        last = None
        for attempt in (1, 2):
            try:
                self._ensure()
                send()
                # A live session answers with telemetry; no reply == dropped
                # socket (half-open), so require real data before trusting it.
                msgs = self.conn.read_messages(2)
                self._update_from(msgs)
                if msgs and (verify is None or verify()):
                    self._empty = 0
                    return True
            except Exception as err:
                last = err
            # stale, silent or unverified -> reconnect and try once more
            self._reconnect()
        if last:
            _LOGGER.warning("BE WAVE: command failed: %s", last)
        return False

    def arm(self, mode=None):
        mode = mode or self.mode
        with self._lock:
            # The hub applies arming after the exit delay (can be >10 s), so accept
            # "arming" as confirmation and let polling flip it to armed_away.
            self._arming_until = time.time() + 90
            self._mode_arming[mode] = time.time() + 90
            ok = self._command(lambda: self.conn.arm(mode),
                               verify=lambda: self.mode_state(mode) in ("armed_away", "arming"))
            if not ok:
                self._arming_until = 0.0
                self._mode_arming.pop(mode, None)
    def disarm(self, mode=None):
        mode = mode or self.mode
        with self._lock:
            self._arming_until = 0.0
            self._mode_arming.pop(mode, None)
            self._command(lambda: self.conn.disarm(mode),
                          verify=lambda: self.mode_state(mode) == "disarmed")
    def set_toggle(self, name, desired):
        if name not in proto.SETTING_IDS:
            return
        with self._lock:
            def _send():
                cur = self.flags.get(name)
                if cur is None or cur != desired:
                    self.conn.toggle_setting(proto.SETTING_IDS[name])
                self.flags[name] = desired
            self._command(_send, verify=lambda: self.flags.get(name) == desired)


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    await _async_register_card(hass)
    hub = BeWaveHub(
        host=entry.data[CONF_HOST],
        login=entry.data[CONF_LOGIN],
        password=entry.data[CONF_PASSWORD],
        device_uuid=entry.data[CONF_DEVICE_UUID],
        serial=entry.data.get(CONF_SERIAL),
        mode=entry.options.get(CONF_MODE, entry.data.get(CONF_MODE, DEFAULT_MODE)),
    )
    entry.async_on_unload(entry.add_update_listener(_async_reload))

    async def _update():
        return await hass.async_add_executor_job(hub.poll)

    coordinator = DataUpdateCoordinator(
        hass, _LOGGER, name=DOMAIN, update_method=_update,
        update_interval=timedelta(seconds=SCAN_INTERVAL_SECONDS),
    )
    await coordinator.async_config_entry_first_refresh()

    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = {"hub": hub, "coordinator": coordinator}
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def _async_reload(hass: HomeAssistant, entry: ConfigEntry) -> None:
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if ok:
        data = hass.data[DOMAIN].pop(entry.entry_id)
        hub: BeWaveHub = data["hub"]
        if hub.conn:
            await hass.async_add_executor_job(hub.conn.close)
    return ok
