"""BE WAVE alarm_control_panel entities: one per arm mode (e.g. "Ochrona Dom")."""
from __future__ import annotations

from homeassistant.components.alarm_control_panel import (
    AlarmControlPanelEntity, AlarmControlPanelEntityFeature, AlarmControlPanelState,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity import DeviceInfo
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN

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
    modes = {k: v for k, v in hub.modes.items() if v.get("devices")}
    if modes:
        async_add_entities(
            [BeWaveAlarmPanel(coordinator, hub, entry, k, v.get("name") or k)
             for k, v in modes.items()])
    else:
        async_add_entities([BeWaveAlarmPanel(coordinator, hub, entry, None, None)])


class BeWaveAlarmPanel(CoordinatorEntity, AlarmControlPanelEntity):
    _attr_has_entity_name = True
    _attr_code_arm_required = False
    _attr_supported_features = AlarmControlPanelEntityFeature.ARM_AWAY

    def __init__(self, coordinator, hub, entry: ConfigEntry, mode, mode_name):
        super().__init__(coordinator)
        self._hub = hub
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

    @property
    def extra_state_attributes(self):
        return {"mode_id": self._mode or self._hub.mode,
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
        await self.hass.async_add_executor_job(self._hub.arm, self._mode)
        await self.coordinator.async_request_refresh()
        self.async_write_ha_state()

    async def async_alarm_disarm(self, code=None):
        await self.hass.async_add_executor_job(self._hub.disarm, self._mode)
        await self.coordinator.async_request_refresh()
        self.async_write_ha_state()
