"""BE WAVE alarm_control_panel entities: one per arm mode (e.g. "Ochrona Dom")."""
from __future__ import annotations

import hmac
import time

from homeassistant.components.alarm_control_panel import (
    AlarmControlPanelEntity, AlarmControlPanelEntityFeature, AlarmControlPanelState,
    CodeFormat,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers.entity import DeviceInfo
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN, CONF_CODE, CONF_CODE_ARM, CONF_CODE_DISARM

_STATE_MAP = {
    "armed_away": AlarmControlPanelState.ARMED_AWAY,
    "arming": AlarmControlPanelState.ARMING,
    "disarmed": AlarmControlPanelState.DISARMED,
    "triggered": AlarmControlPanelState.TRIGGERED,
}


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities):
    data = hass.data[DOMAIN][entry.entry_id]
    coordinator, hub = data["coordinator"], data["hub"]
    # Modes with devices become their own entity. Without any (older firmware, or
    # modes not read yet) keep the single entity driven by the "mode" option.
    modes = {k: v for k, v in hub.modes.items() if v.get("devices") or v.get("default")}
    if modes:
        async_add_entities(
            [BeWaveAlarmPanel(coordinator, hub, entry, k,
                              v.get("name") or ("Pełne czuwanie" if v.get("default") else k))
             for k, v in modes.items()])
    else:
        async_add_entities([BeWaveAlarmPanel(coordinator, hub, entry, None, None)])


class BeWaveAlarmPanel(CoordinatorEntity, AlarmControlPanelEntity):
    _attr_has_entity_name = True
    _attr_supported_features = AlarmControlPanelEntityFeature.ARM_AWAY

    def __init__(self, coordinator, hub, entry: ConfigEntry, mode, mode_name):
        super().__init__(coordinator)
        self._hub = hub
        self._entry = entry
        self._mode = mode                      # None = legacy single entity
        serial = entry.data.get("serial") or entry.entry_id
        self._attr_name = mode_name            # None -> device name
        self._attr_unique_id = (f"bewave_{serial}_panel" if mode is None
                                else f"bewave_{serial}_panel_{mode}")
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, serial)},
            manufacturer="Satel",
            model="BE WAVE HUB / HYBRID",
            name=f"BE WAVE {serial}",
        )

    # --- optional PIN (checked here, in Home Assistant) ---
    def _pin(self) -> str:
        return (self._entry.options.get(CONF_CODE) or "").strip()

    @property
    def code_format(self):
        pin = self._pin()
        if not pin:
            return None
        return CodeFormat.NUMBER if pin.isdigit() else CodeFormat.TEXT

    @property
    def code_arm_required(self) -> bool:
        return bool(self._pin()) and self._entry.options.get(CONF_CODE_ARM, True)

    def _check_pin(self, code, needed: bool) -> None:
        pin = self._pin()
        if not pin or not needed:
            return
        hub = self._hub
        wait = int(hub.code_locked_until - time.time())
        if wait > 0:
            raise ServiceValidationError(f"Too many wrong codes, try again in {wait} s")
        if not code or not hmac.compare_digest(str(code).encode(), pin.encode()):
            hub.code_fails += 1
            if hub.code_fails >= 5:
                hub.code_fails = 0
                hub.code_locked_until = time.time() + 60
            raise ServiceValidationError("Invalid code")
        hub.code_fails = 0

    @property
    def extra_state_attributes(self):
        return {"code_disarm_required": bool(self._pin()) and
                self._entry.options.get(CONF_CODE_DISARM, True),
                "mode_id": self._mode or self._hub.mode,
                "available_modes": {k: v.get("name") or k for k, v in self._hub.modes.items()}}

    @property
    def alarm_state(self) -> AlarmControlPanelState | None:
        if self._mode is None:
            st = self._hub.state or (self.coordinator.data or {}).get("state")
        else:
            st = self._hub.mode_state(self._mode)
            # armed mode + a violated contact/motion sensor elsewhere = triggered
            if self._hub.state == "triggered" and st == "armed_away":
                st = "triggered"
        return _STATE_MAP.get(st)

    async def async_alarm_arm_away(self, code=None):
        self._check_pin(code, self.code_arm_required)
        await self.hass.async_add_executor_job(self._hub.arm, self._mode)
        await self.coordinator.async_request_refresh()
        self.async_write_ha_state()

    async def async_alarm_disarm(self, code=None):
        self._check_pin(code, self.extra_state_attributes["code_disarm_required"])
        await self.hass.async_add_executor_job(self._hub.disarm, self._mode)
        await self.coordinator.async_request_refresh()
        self.async_write_ha_state()
