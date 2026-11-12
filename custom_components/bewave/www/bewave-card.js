/* BE WAVE alarm card for Home Assistant (vanilla custom element, no dependencies).
 *
 *   type: custom:bewave-card
 *   title: Alarm                 # optional
 *   entities:                    # optional - auto-detected when omitted
 *     - alarm_control_panel.be_wave_xxx_ochrona_dom
 *     - entity: alarm_control_panel.be_wave_xxx_ochrona_piwnica
 *       name: Piwnica
 *   sensors:                     # optional - door/motion/temperature entities
 *     - binary_sensor.piwnica_czujka_otwarcia
 *   confirm_disarm: false        # optional - ask before disarming
 */
const T = {
  pl: { disarmed: "Rozbrojony", armed_away: "Uzbrojony", arming: "Uzbrajanie…",
        triggered: "ALARM", pending: "Oczekiwanie", unavailable: "Niedostępny", unknown: "Nieznany",
        arm: "Uzbrój", disarm: "Rozbrój", cancel: "Anuluj", none: "Nie znaleziono encji alarmu BE WAVE.",
        all_off: "Wszystko rozbrojone", some_on: (a, n) => `Uzbrojone: ${a} z ${n}`,
        arming_h: "Uzbrajanie…", alarm_h: "ALARM!", sensors: "Czujki", open: "Otwarte", closed: "Zamknięte",
        motion: "Ruch", clear: "Brak", confirm: "Rozbroić?" },
  en: { disarmed: "Disarmed", armed_away: "Armed", arming: "Arming…",
        triggered: "ALARM", pending: "Pending", unavailable: "Unavailable", unknown: "Unknown",
        arm: "Arm", disarm: "Disarm", cancel: "Cancel", none: "No BE WAVE alarm entities found.",
        all_off: "All disarmed", some_on: (a, n) => `Armed: ${a} of ${n}`,
        arming_h: "Arming…", alarm_h: "ALARM!", sensors: "Sensors", open: "Open", closed: "Closed",
        motion: "Motion", clear: "Clear", confirm: "Disarm?" },
};

const ICON_SHIELD = '<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>';
const ICON_LOCK = '<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M12 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm6-9h-1V6a5 5 0 0 0-10 0v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zM9 6a3 3 0 0 1 6 0v2H9V6z"/></svg>';
const ICON_OPEN = '<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M12 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm6-9h-1V6a5 5 0 0 0-9.9-1h2A3 3 0 0 1 15 6v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2z"/></svg>';
const ICON_BELL = '<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4a1.5 1.5 0 0 0-3 0v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>';

class BewaveCard extends HTMLElement {
  setConfig(config) {
    this._config = Object.assign({ confirm_disarm: false }, config || {});
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this._build();
  }
  static getStubConfig() { return { title: "Alarm" }; }
  getCardSize() { return 3 + (this._rows ? this._rows.length : 2); }

  set hass(hass) {
    this._hass = hass;
    this._update();
  }

  _t() { return T[((this._hass && this._hass.language) || "en").startsWith("pl") ? "pl" : "en"]; }

  _entities() {
    const h = this._hass;
    if (!h) return [];
    const cfg = this._config.entities;
    if (Array.isArray(cfg) && cfg.length) {
      return cfg.map((e) => (typeof e === "string" ? { entity: e } : e)).filter((e) => h.states[e.entity]);
    }
    return Object.keys(h.states)
      .filter((id) => id.startsWith("alarm_control_panel.") &&
        h.states[id].attributes && "mode_id" in h.states[id].attributes &&
        "available_modes" in h.states[id].attributes)
      .sort((a, b) => (h.states[a].attributes.friendly_name || a).localeCompare(h.states[b].attributes.friendly_name || b))
      .map((id) => ({ entity: id }));
  }

  _name(e) {
    if (e.name) return e.name;
    const st = this._hass.states[e.entity];
    const fn = (st.attributes.friendly_name || e.entity).replace(/^BE WAVE \S+\s+/i, "");
    return fn;
  }

  _build() {
    this.shadowRoot.innerHTML = `
      <style>
        ha-card { padding: 16px; overflow: hidden; }
        .head { display: flex; align-items: center; gap: 14px; margin-bottom: 14px; }
        .badge { width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center;
                 color: #fff; background: var(--bw-c, var(--disabled-text-color, #9e9e9e)); flex: none;
                 transition: background .3s; }
        .head.alarm .badge { animation: pulse 0.9s infinite; }
        .head.arming .badge { animation: blink 1.2s infinite; }
        .htxt { min-width: 0; }
        .title { font-size: 12px; letter-spacing: .06em; text-transform: uppercase; opacity: .65;
                 color: var(--secondary-text-color); }
        .status { font-size: 20px; font-weight: 600; color: var(--primary-text-color); line-height: 1.2; }
        .rows { display: grid; gap: 8px; }
        .row { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 12px;
               background: var(--secondary-background-color, rgba(127,127,127,.12));
               border-left: 4px solid var(--bw-c, var(--disabled-text-color, #9e9e9e)); }
        .row.alarm { animation: rowpulse 0.9s infinite; }
        .ico { color: var(--bw-c); display: grid; place-items: center; flex: none; }
        .info { flex: 1; min-width: 0; }
        .name { font-weight: 500; color: var(--primary-text-color); white-space: nowrap;
                overflow: hidden; text-overflow: ellipsis; }
        .state { font-size: 13px; color: var(--bw-c); font-weight: 500; }
        button { border: 0; border-radius: 999px; padding: 8px 16px; font: inherit; font-size: 14px;
                 font-weight: 600; cursor: pointer; color: #fff; background: var(--bw-b);
                 transition: filter .15s, transform .05s; flex: none; }
        button:hover { filter: brightness(1.08); } button:active { transform: scale(.96); }
        button[disabled] { opacity: .5; cursor: default; }
        .sh { margin: 16px 0 8px; font-size: 12px; letter-spacing: .06em; text-transform: uppercase;
              color: var(--secondary-text-color); opacity: .75; }
        .chips { display: flex; flex-wrap: wrap; gap: 8px; }
        .chip { display: flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 999px;
                font-size: 13px; background: var(--secondary-background-color, rgba(127,127,127,.12));
                color: var(--primary-text-color); }
        .chip .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--disabled-text-color,#9e9e9e); }
        .chip.on .dot { background: var(--warning-color, #fb8c00); }
        .chip b { font-weight: 600; opacity: .85; }
        .empty { color: var(--secondary-text-color); padding: 8px 0; }
        @keyframes pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(244,67,54,.6); } 50% { box-shadow: 0 0 0 10px rgba(244,67,54,0); } }
        @keyframes blink { 50% { opacity: .55; } }
        @keyframes rowpulse { 50% { background: rgba(244,67,54,.18); } }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
      </style>
      <ha-card>
        <div class="head" id="head"><div class="badge" id="badge"></div>
          <div class="htxt"><div class="title" id="title"></div><div class="status" id="status"></div></div></div>
        <div class="rows" id="rows"></div>
        <div id="sens"></div>
      </ha-card>`;
    this._rows = [];
    this._sig = "";
    this.shadowRoot.getElementById("rows").addEventListener("click", (ev) => {
      const b = ev.target.closest("button[data-e]");
      if (b) this._act(b.dataset.e, b.dataset.s);
    });
  }

  _act(entity, service) {
    if (!this._hass) return;
    const t = this._t();
    if (service === "alarm_disarm" && this._config.confirm_disarm && !window.confirm(t.confirm)) return;
    this._hass.callService("alarm_control_panel", service, { entity_id: entity });
  }

  _colors(state) {
    switch (state) {
      case "disarmed":   return { c: "var(--success-color, #43a047)", b: "var(--primary-color, #03a9f4)" };
      case "armed_away": case "armed_home": case "armed_night": case "armed_vacation":
      case "armed_custom_bypass":
                         return { c: "var(--error-color, #e53935)", b: "var(--error-color, #e53935)" };
      case "arming": case "pending":
                         return { c: "var(--warning-color, #fb8c00)", b: "var(--warning-color, #fb8c00)" };
      case "triggered":  return { c: "var(--error-color, #e53935)", b: "var(--error-color, #e53935)" };
      default:           return { c: "var(--disabled-text-color, #9e9e9e)", b: "var(--disabled-text-color, #9e9e9e)" };
    }
  }

  _icon(state) {
    if (state === "disarmed") return ICON_OPEN;
    if (state === "triggered") return ICON_BELL;
    if (state && state.startsWith("armed")) return ICON_LOCK;
    return ICON_SHIELD;
  }

  _update() {
    if (!this.shadowRoot || !this._hass || !this._config) return;
    const t = this._t(), h = this._hass;
    const ents = this._entities();
    const rows = ents.map((e) => ({ id: e.entity, name: this._name(e), state: h.states[e.entity].state }));
    const sensors = (this._config.sensors || []).map((s) => (typeof s === "string" ? { entity: s } : s))
      .filter((s) => h.states[s.entity]);
    const sensRows = sensors.map((s) => {
      const st = h.states[s.entity];
      const dc = st.attributes.device_class;
      let txt = st.state, on = false;
      if (s.entity.startsWith("binary_sensor.")) {
        on = st.state === "on";
        txt = dc === "motion" ? (on ? t.motion : t.clear) : (on ? t.open : t.closed);
      } else {
        txt = st.state + (st.attributes.unit_of_measurement ? " " + st.attributes.unit_of_measurement : "");
      }
      return { name: s.name || (st.attributes.friendly_name || s.entity).replace(/^BE WAVE \S+\s+/i, ""), txt, on };
    });
    const sig = JSON.stringify([rows, sensRows, t.arm]);
    if (sig === this._sig) return;
    this._sig = sig; this._rows = rows;

    const sr = this.shadowRoot;
    const armedN = rows.filter((r) => r.state.startsWith("armed")).length;
    const trig = rows.some((r) => r.state === "triggered");
    const arming = rows.some((r) => r.state === "arming" || r.state === "pending");
    const head = sr.getElementById("head");
    let hs = "disarmed", htxt = t.all_off;
    if (!rows.length) { hs = "unknown"; htxt = t.none; }
    else if (trig) { hs = "triggered"; htxt = t.alarm_h; }
    else if (arming) { hs = "arming"; htxt = t.arming_h; }
    else if (armedN) { hs = "armed_away"; htxt = t.some_on(armedN, rows.length); }
    head.className = "head" + (trig ? " alarm" : arming ? " arming" : "");
    head.style.setProperty("--bw-c", this._colors(hs).c);
    sr.getElementById("badge").innerHTML = this._icon(hs);
    sr.getElementById("title").textContent = this._config.title || "BE WAVE";
    sr.getElementById("status").textContent = htxt;

    sr.getElementById("rows").innerHTML = rows.map((r) => {
      const col = this._colors(r.state);
      const busy = r.state === "arming" || r.state === "pending";
      const isOff = r.state === "disarmed";
      const unavailable = r.state === "unavailable" || r.state === "unknown";
      const label = unavailable ? "" : isOff ? t.arm : busy ? t.cancel : t.disarm;
      const svc = isOff ? "alarm_arm_away" : "alarm_disarm";
      return `<div class="row${r.state === "triggered" ? " alarm" : ""}" style="--bw-c:${col.c};--bw-b:${col.b}">
        <div class="ico">${this._icon(r.state)}</div>
        <div class="info"><div class="name">${this._esc(r.name)}</div>
          <div class="state">${this._esc(t[r.state] || r.state)}</div></div>
        ${label ? `<button data-e="${this._esc(r.id)}" data-s="${svc}" style="--bw-b:${isOff ? "var(--primary-color,#03a9f4)" : col.b}">${label}</button>` : ""}
      </div>`;
    }).join("");

    sr.getElementById("sens").innerHTML = sensRows.length
      ? `<div class="sh">${t.sensors}</div><div class="chips">${sensRows.map((s) =>
          `<div class="chip${s.on ? " on" : ""}"><span class="dot"></span>${this._esc(s.name)} <b>${this._esc(s.txt)}</b></div>`).join("")}</div>`
      : "";
  }

  _esc(v) { return String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
}

if (!customElements.get("bewave-card")) customElements.define("bewave-card", BewaveCard);
window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === "bewave-card")) {
  window.customCards.push({ type: "bewave-card", name: "BE WAVE alarm",
    description: "Arm modes of a Satel BE WAVE panel with state colours and arm/disarm buttons." });
}
