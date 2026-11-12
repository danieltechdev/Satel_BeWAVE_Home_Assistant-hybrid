"""BE WAVE alarm_control_panel entity."""
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
    async_add_entities([BeWaveAlarmPanel(data["coordinator"], data["hub"], entry)])


class BeWaveAlarmPanel(CoordinatorEntity, AlarmControlPanelEntity):
    _attr_has_entity_name = True
    _attr_name = None
    _attr_code_arm_required = False
    _attr_supported_features = (
        AlarmControlPanelEntityFeature.ARM_AWAY
    )

    def __init__(self, coordinator, hub, entry: ConfigEntry):
        super().__init__(coordinator)
        self._hub = hub
        serial = entry.data.get("serial") or entry.entry_id
        self._attr_unique_id = f"bewave_{serial}_panel"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, serial)},
            manufacturer="Satel",
            model="BE WAVE HUB / HYBRID",
            name=f"BE WAVE {serial}",
        )

    @property
    def extra_state_attributes(self):
        # arm modes known to the panel (id -> name); the active one is set in the
        # integration options ("mode"), e.g. 1410c = "Ochrona Piwnica"
        return {"active_mode": self._hub.mode,
                "available_modes": {k: v.get("name") or k for k, v in self._hub.modes.items()}}

    @property
    def alarm_state(self) -> AlarmControlPanelState | None:
        st = self._hub.state or (self.coordinator.data or {}).get("state")
        return _STATE_MAP.get(st)

    async def async_alarm_arm_away(self, code=None):
        await self.hass.async_add_executor_job(self._hub.arm)
        await self.coordinator.async_request_refresh()
        self.async_write_ha_state()

    async def async_alarm_disarm(self, code=None):
        await self.hass.async_add_executor_job(self._hub.disarm)
        await self.coordinator.async_request_refresh()
        self.async_write_ha_state()
