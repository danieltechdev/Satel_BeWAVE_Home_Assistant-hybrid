/* BE WAVE alarm card for Home Assistant (vanilla custom element, no dependencies).
 *
 *   type: custom:bewave-card
 *   title: Alarm                 # optional
 *   expanded: false              # optional - true = all modes open, "first" = first one
 *   show_details: true           # optional - false hides the expandable device details
 *   entities:                    # optional - auto-detected when omitted
 *     - alarm_control_panel.be_wave_xxx_ochrona_dom
 *     - entity: alarm_control_panel.be_wave_xxx_ochrona_piwnica
 *       name: Piwnica
 *   sensors:                     # optional - extra entities shown as chips
 *     - sensor.piwnica_temperatura
 *   confirm_disarm: false        # optional - ask before disarming (when no PIN is set)
 */
const T = {
  pl: {
    disarmed: "Rozbrojony", armed_away: "Uzbrojony", arming: "Uzbrajanie…", triggered: "ALARM",
    pending: "Oczekiwanie", unavailable: "Niedostępny", unknown: "Nieznany",
    arm: "Uzbrój", disarm: "Rozbrój", cancel: "Anuluj",
    none: "Nie znaleziono encji alarmu BE WAVE.",
    all_off: "Wszystko rozbrojone", some_on: (a, n) => `Uzbrojone: ${a} z ${n}`,
    arming_h: "Uzbrajanie…", alarm_h: "ALARM!",
    sensors: "Czujki", open: "Otwarte", closed: "Zamknięte", motion: "Ruch", clear: "Brak ruchu",
    bypass: "Pominięta", ok: "OK",
    devs: (n) => n === 1 ? "1 urządzenie" : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? `${n} urządzenia` : `${n} urządzeń`),
    n_open: (n) => `otwarte: ${n}`, n_motion: (n) => `ruch: ${n}`, low_batt: (v) => `bateria ${v}%`,
    no_devs: "Brak danych o urządzeniach tego trybu.",
    battery: "Bateria", signal: "Sygnał", temp: "Temperatura", volt: "Napięcie", guarded: "czuwa",
    mode: "Tryb", details: "Szczegóły",
    confirm: "Rozbroić?", pin: "Wpisz kod", pin_ok: "OK", pin_cancel: "Anuluj", pin_bad: "Błędny kod",
    pin_for: "Uzbrojenie", pin_for_d: "Rozbrojenie",
  },
  en: {
    disarmed: "Disarmed", armed_away: "Armed", arming: "Arming…", triggered: "ALARM",
    pending: "Pending", unavailable: "Unavailable", unknown: "Unknown",
    arm: "Arm", disarm: "Disarm", cancel: "Cancel",
    none: "No BE WAVE alarm entities found.",
    all_off: "All disarmed", some_on: (a, n) => `Armed: ${a} of ${n}`,
    arming_h: "Arming…", alarm_h: "ALARM!",
    sensors: "Sensors", open: "Open", closed: "Closed", motion: "Motion", clear: "No motion",
    bypass: "Bypassed", ok: "OK",
    devs: (n) => n === 1 ? "1 device" : `${n} devices`,
    n_open: (n) => `open: ${n}`, n_motion: (n) => `motion: ${n}`, low_batt: (v) => `battery ${v}%`,
    no_devs: "No device data for this mode.",
    battery: "Battery", signal: "Signal", temp: "Temperature", volt: "Voltage", guarded: "armed",
    mode: "Mode", details: "Details",
    confirm: "Disarm?", pin: "Enter code", pin_ok: "OK", pin_cancel: "Cancel", pin_bad: "Wrong code",
    pin_for: "Arming", pin_for_d: "Disarming",
  },
};

const LOW_BATTERY = 20;
const svg = (d, s = 22) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true"><path fill="currentColor" d="${d}"/></svg>`;
const P = {
  shield: "M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z",
  lock: "M12 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm6-9h-1V6a5 5 0 0 0-10 0v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zM9 6a3 3 0 0 1 6 0v2H9V6z",
  unlock: "M12 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm6-9h-1V6a5 5 0 0 0-9.9-1h2A3 3 0 0 1 15 6v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2z",
  bell: "M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4a1.5 1.5 0 0 0-3 0v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z",
  chevron: "M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z",
  door: "M8 3h10a1 1 0 0 1 1 1v16h2v2H3v-2h2V4a1 1 0 0 1 1-1h2zm-1 2v15h10V5H7zm7 6h2v2h-2v-2z",
  motion: "M13.5 5.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM9.8 8.9 7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3A7.3 7.3 0 0 0 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6a2 2 0 0 0-2.5-.8L6 8.3V13h2V9.6l1.8-.7z",
  device: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12zm0 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  temp: "M15 13V5a3 3 0 0 0-6 0v8a5 5 0 1 0 6 0zm-3-9a1 1 0 0 1 1 1v3h-2V5a1 1 0 0 1 1-1z",
  bolt: "M11 21h-1l1-7H7.5c-.6 0-.6-.3-.4-.7L13 3h1l-1 7h3.5c.5 0 .6.3.4.7L11 21z",
  warn: "M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z",
};

function batteryIcon(pct) {
  const w = Math.max(0, Math.min(100, pct)) / 100 * 13;
  return `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="2.5" y="7.5" width="17" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="20.3" y="10" width="1.8" height="4" rx=".6" fill="currentColor"/><rect x="4.5" y="9.5" width="${w.toFixed(1)}" height="5" rx=".8" fill="currentColor"/></svg>`;
}
function signalIcon(pct) {
  const lvl = pct >= 75 ? 4 : pct >= 50 ? 3 : pct >= 25 ? 2 : pct > 0 ? 1 : 0;
  const bars = [0, 1, 2, 3].map((i) =>
    `<rect x="${3 + i * 5}" y="${16 - i * 4}" width="3.4" height="${4 + i * 4}" rx=".8" fill="currentColor" opacity="${i < lvl ? 1 : 0.25}"/>`).join("");
  return `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">${bars}</svg>`;
}

class BewaveCard extends HTMLElement {
  setConfig(config) {
    this._config = Object.assign({ confirm_disarm: false, show_details: true, expanded: false }, config || {});
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this._open = null;                 // Set of expanded entity ids (null = not initialised)
    this._build();
  }
  static getStubConfig() { return { title: "Alarm" }; }
  getCardSize() { return 2 + (this._rows ? this._rows.length : 2); }

  set hass(hass) { this._hass = hass; this._update(); }

  _t() { return T[((this._hass && this._hass.language) || "en").startsWith("pl") ? "pl" : "en"]; }

  _entities() {
    const h = this._hass;
    if (!h) return [];
    const cfg = this._config.entities;
    if (Array.isArray(cfg) && cfg.length) {
      return cfg.map((e) => (typeof e === "string" ? { entity: e } : e)).filter((e) => h.states[e.entity]);
    }
    return Object.keys(h.states)
      .filter((id) => id.startsWith("alarm_control_panel.") && h.states[id].attributes &&
        "mode_id" in h.states[id].attributes && "available_modes" in h.states[id].attributes)
      .sort((a, b) => (h.states[a].attributes.friendly_name || a).localeCompare(h.states[b].attributes.friendly_name || b))
      .map((id) => ({ entity: id }));
  }

  _name(e) {
    if (e.name) return e.name;
    const st = this._hass.states[e.entity];
    return (st.attributes.friendly_name || e.entity).replace(/^BE WAVE \S+\s+/i, "");
  }

  _build() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { --bw-ok: var(--success-color, #43a047); --bw-armed: var(--error-color, #db4437);
                --bw-warn: var(--warning-color, #ffa600); --bw-off: var(--disabled-text-color, #9e9e9e);
                --bw-soft: var(--secondary-background-color, rgba(127,127,127,.12));
                --bw-line: var(--divider-color, rgba(127,127,127,.25)); }
        ha-card { padding: 16px; overflow: hidden; }
        button { font: inherit; border: 0; cursor: pointer; color: inherit; background: none; padding: 0; }
        button:focus-visible { outline: 2px solid var(--primary-color, #03a9f4); outline-offset: 2px; }

        .head { display: flex; align-items: center; gap: 14px; margin-bottom: 14px; }
        .badge { width: 48px; height: 48px; border-radius: 50%; display: grid; place-items: center; flex: none;
                 color: #fff; background: var(--c, var(--bw-off)); transition: background .3s; }
        .head.alarm .badge { animation: pulse .9s infinite; }
        .head.arming .badge { animation: blink 1.2s infinite; }
        .title { font-size: 12px; letter-spacing: .06em; text-transform: uppercase;
                 color: var(--secondary-text-color); }
        .status { font-size: 20px; font-weight: 600; color: var(--primary-text-color); line-height: 1.25; }

        .modes { display: grid; gap: 8px; }
        .mode { border-radius: 14px; background: var(--bw-soft); position: relative; overflow: hidden; }
        .mode::before { content: ""; position: absolute; inset: 0 auto 0 0; width: 4px; background: var(--c); }
        .mode.alarm { animation: rowpulse .9s infinite; }
        .mrow { display: flex; align-items: center; gap: 8px; padding: 6px 10px 6px 4px; }
        .mtoggle { flex: 1; min-width: 0; display: flex; align-items: center; gap: 12px; text-align: left;
                   padding: 6px 4px 6px 12px; border-radius: 10px; }
        .mtoggle[disabled] { cursor: default; }
        .ico { color: var(--c); display: grid; place-items: center; flex: none; }
        .info { flex: 1; min-width: 0; }
        .name { font-weight: 600; color: var(--primary-text-color); white-space: nowrap;
                overflow: hidden; text-overflow: ellipsis; }
        .sub { font-size: 13px; color: var(--secondary-text-color); display: flex; flex-wrap: wrap;
               gap: 2px 8px; align-items: center; }
        .sub .st { color: var(--c); font-weight: 600; }
        .sub .w { color: var(--bw-warn); font-weight: 600; display: inline-flex; align-items: center; gap: 3px; }
        .sub .w.bad { color: var(--bw-armed); }
        .chev { color: var(--secondary-text-color); display: grid; place-items: center; flex: none;
                transition: transform .2s; }
        .mode.open .chev { transform: rotate(180deg); }
        .act { flex: none; border-radius: 999px; padding: 8px 16px; font-size: 14px; font-weight: 600;
               color: #fff; background: var(--b); transition: filter .15s, transform .05s; }
        .act:hover { filter: brightness(1.08); } .act:active { transform: scale(.96); }

        .mbody { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .22s ease; }
        .mode.open .mbody { grid-template-rows: 1fr; }
        .minner { overflow: hidden; min-height: 0; }
        .mpad { padding: 2px 12px 12px 16px; display: grid; gap: 8px; }
        .dev { background: var(--card-background-color, var(--ha-card-background, #fff)); border-radius: 10px;
               padding: 10px 12px; display: grid; gap: 8px; border: 1px solid var(--bw-line); }
        .dtop { display: flex; align-items: center; gap: 10px; }
        .dico { color: var(--secondary-text-color); display: grid; place-items: center; flex: none; }
        .dev.on .dico { color: var(--bw-warn); }
        .dname { flex: 1; min-width: 0; }
        .dname b { display: block; font-weight: 600; color: var(--primary-text-color); white-space: nowrap;
                   overflow: hidden; text-overflow: ellipsis; }
        .dname span { font-size: 12px; color: var(--secondary-text-color); }
        .pill { flex: none; font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 999px;
                background: var(--bw-soft); color: var(--secondary-text-color); white-space: nowrap; }
        .pill.on { background: var(--bw-warn); color: #000; }
        .pill.byp { background: transparent; border: 1px dashed var(--bw-off); }
        .mets { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 13px;
                color: var(--primary-text-color); font-variant-numeric: tabular-nums; }
        .met { display: inline-flex; align-items: center; gap: 5px; }
        .met svg { color: var(--secondary-text-color); }
        .met.low, .met.low svg { color: var(--bw-armed); font-weight: 600; }
        .met.g, .met.g svg { color: var(--bw-armed); }
        .foot { font-size: 12px; color: var(--secondary-text-color); padding: 0 2px; }
        .nodev { font-size: 13px; color: var(--secondary-text-color); padding: 4px 2px; }

        .sh { margin: 16px 0 8px; font-size: 12px; letter-spacing: .06em; text-transform: uppercase;
              color: var(--secondary-text-color); }
        .chips { display: flex; flex-wrap: wrap; gap: 8px; }
        .chip { display: flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 999px;
                font-size: 13px; background: var(--bw-soft); color: var(--primary-text-color); }
        .chip .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--bw-off); }
        .chip.on .dot { background: var(--bw-warn); }
        .chip b { font-weight: 600; }

        .pad { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 4px 0 2px; outline: none; }
        .pad[hidden] { display: none; }
        ha-card.padmode .head, ha-card.padmode .modes, ha-card.padmode #sens { display: none; }
        .pad .pt { font-size: 13px; letter-spacing: .06em; text-transform: uppercase; color: var(--secondary-text-color); }
        .pad .pn { font-weight: 600; font-size: 17px; color: var(--primary-text-color); }
        .dots { height: 26px; display: flex; gap: 10px; align-items: center; justify-content: center; }
        .dots i { width: 13px; height: 13px; border-radius: 50%; background: var(--primary-text-color); opacity: .85; }
        .perr { height: 18px; font-size: 13px; color: var(--bw-armed); font-weight: 500; }
        .keys { display: grid; grid-template-columns: repeat(3, 62px); gap: 10px; }
        .keys button { height: 52px; border-radius: 14px; font-size: 20px; font-weight: 600;
                       background: var(--bw-soft); color: var(--primary-text-color); }
        .keys button.ok, .pad .okb { background: var(--primary-color, #03a9f4); color: #fff; }
        .pad .okb { border-radius: 999px; padding: 8px 22px; font-weight: 600; }
        .pad input { width: 200px; text-align: center; font: inherit; font-size: 20px; padding: 10px; border-radius: 12px;
                     background: var(--bw-soft); color: var(--primary-text-color); border: 1px solid var(--bw-line); }
        .pad .cancel { color: var(--secondary-text-color); font-weight: 500; padding: 6px 12px; }
        .shake { animation: shake .3s; }

        @keyframes pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(219,68,55,.6); } 50% { box-shadow: 0 0 0 10px rgba(219,68,55,0); } }
        @keyframes blink { 50% { opacity: .55; } }
        @keyframes rowpulse { 50% { background: rgba(219,68,55,.2); } }
        @keyframes shake { 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
      </style>
      <ha-card>
        <div class="head" id="head"><div class="badge" id="badge"></div>
          <div><div class="title" id="title"></div><div class="status" id="status"></div></div></div>
        <div class="modes" id="modes"></div>
        <div id="sens"></div>
        <div class="pad" id="pad" hidden tabindex="-1"></div>
      </ha-card>`;
    this._rows = [];
    this._sig = "";
    this.shadowRoot.getElementById("modes").addEventListener("click", (ev) => {
      const act = ev.target.closest("button.act");
      if (act) return this._act(act.dataset.e, act.dataset.s);
      const tg = ev.target.closest("button.mtoggle");
      if (tg && !tg.disabled) this._toggle(tg.dataset.x);
    });
  }

  _toggle(id) {
    if (this._open.has(id)) this._open.delete(id); else this._open.add(id);
    const sec = this.shadowRoot.querySelector(`.mode[data-id="${CSS.escape(id)}"]`);
    if (!sec) return;
    const open = this._open.has(id);
    sec.classList.toggle("open", open);
    sec.querySelector(".mtoggle").setAttribute("aria-expanded", String(open));
    sec.querySelector(".mbody").toggleAttribute("inert", !open);
  }

  // ---- actions ----
  _act(entity, service) {
    if (!this._hass) return;
    const t = this._t();
    const a = (this._hass.states[entity] || {}).attributes || {};
    const needPin = service === "alarm_disarm" ? !!a.code_disarm_required : !!a.code_arm_required;
    if (needPin) { this._openPad(entity, service, a.code_format === "number"); return; }
    if (service === "alarm_disarm" && this._config.confirm_disarm && !window.confirm(t.confirm)) return;
    this._call(entity, service, undefined);
  }

  _call(entity, service, code) {
    const data = { entity_id: entity };
    if (code !== undefined) data.code = code;
    return Promise.resolve(this._hass.callService("alarm_control_panel", service, data));
  }

  // ---- PIN pad ----
  _openPad(entity, service, numeric) {
    this._pad = { entity, service, numeric, value: "", error: "", busy: false };
    this._renderPad();
    const pad = this.shadowRoot.getElementById("pad");
    pad.hidden = false;
    this.shadowRoot.querySelector("ha-card").classList.add("padmode");
    (pad.querySelector("input") || pad).focus();
  }

  _closePad() {
    this._pad = null;
    const pad = this.shadowRoot.getElementById("pad");
    pad.hidden = true; pad.innerHTML = "";
    this.shadowRoot.querySelector("ha-card").classList.remove("padmode");
  }

  _renderPad() {
    const p = this._pad, t = this._t(), pad = this.shadowRoot.getElementById("pad");
    const nm = this._name({ entity: p.entity });
    const body = p.numeric
      ? `<div class="dots">${"<i></i>".repeat(p.value.length)}</div>
         <div class="keys">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-k="${n}">${n}</button>`).join("")}
           <button data-k="back" aria-label="Backspace">⌫</button><button data-k="0">0</button><button class="ok" data-k="ok">${t.pin_ok}</button></div>`
      : `<input type="password" autocomplete="off" value="${this._esc(p.value)}" aria-label="${t.pin}">
         <button class="okb" data-k="ok">${t.pin_ok}</button>`;
    pad.innerHTML = `<div class="pt">${p.service === "alarm_disarm" ? t.pin_for_d : t.pin_for}</div>
      <div class="pn">${this._esc(nm)}</div>${body}
      <div class="perr">${this._esc(p.error)}</div>
      <button class="cancel" data-k="cancel">${t.pin_cancel}</button>`;
    if (!this._padBound) {
      this._padBound = true;
      pad.addEventListener("click", (ev) => { const b = ev.target.closest("button[data-k]"); if (b) this._padKey(b.dataset.k); });
      pad.addEventListener("keydown", (ev) => {
        if (!this._pad) return;
        if (ev.key === "Escape") this._padKey("cancel");
        else if (ev.key === "Enter") this._padKey("ok");
        else if (this._pad.numeric && /^[0-9]$/.test(ev.key)) this._padKey(ev.key);
        else if (this._pad.numeric && ev.key === "Backspace") this._padKey("back");
      });
      pad.addEventListener("input", (ev) => { if (this._pad && ev.target.tagName === "INPUT") this._pad.value = ev.target.value; });
    }
  }

  _padKey(k) {
    const p = this._pad; if (!p || p.busy) return;
    if (k === "cancel") return this._closePad();
    if (k === "back") p.value = p.value.slice(0, -1);
    else if (k !== "ok") { if (p.value.length < 12) p.value += k; }
    p.error = "";
    if (k !== "ok") return this._renderPad();
    if (!p.value) return;
    p.busy = true;
    this._call(p.entity, p.service, p.value).then(() => this._closePad()).catch(() => {
      p.busy = false; p.value = ""; p.error = this._t().pin_bad;
      this._renderPad();
      const pad = this.shadowRoot.getElementById("pad");
      pad.classList.remove("shake"); void pad.offsetWidth; pad.classList.add("shake");
      (pad.querySelector("input") || pad).focus();
    });
  }

  // ---- rendering ----
  _color(state) {
    if (state === "disarmed") return "var(--bw-ok)";
    if (state === "triggered" || (state && state.startsWith("armed"))) return "var(--bw-armed)";
    if (state === "arming" || state === "pending") return "var(--bw-warn)";
    return "var(--bw-off)";
  }

  _icon(state) {
    if (state === "disarmed") return svg(P.unlock);
    if (state === "triggered") return svg(P.bell);
    if (state && state.startsWith("armed")) return svg(P.lock);
    return svg(P.shield);
  }

  _devHtml(d, t) {
    const isContact = d.cat === "contact", isMotion = d.cat === "motion";
    const on = (isContact || isMotion) && d.state === 1;
    let pill = "";
    if (d.bypass) pill = `<span class="pill byp">${t.bypass}</span>`;
    else if (isContact && d.state != null) pill = `<span class="pill${on ? " on" : ""}">${on ? t.open : t.closed}</span>`;
    else if (isMotion && d.state != null) pill = `<span class="pill${on ? " on" : ""}">${on ? t.motion : t.clear}</span>`;
    const mets = [];
    if (d.armed === 1 || d.armed === 2) mets.push(`<span class="met g">${svg(P.lock, 16)}${t.guarded}</span>`);
    if (d.battery != null) mets.push(`<span class="met${d.battery <= LOW_BATTERY ? " low" : ""}" title="${t.battery}">${batteryIcon(d.battery)}${d.battery}%</span>`);
    if (d.signal != null) mets.push(`<span class="met" title="${t.signal}">${signalIcon(d.signal)}${d.signal}%</span>`);
    if (d.temp != null) mets.push(`<span class="met" title="${t.temp}">${svg(P.temp, 16)}${Number(d.temp).toFixed(1)} °C</span>`);
    if (d.volt != null) mets.push(`<span class="met" title="${t.volt}">${svg(P.bolt, 16)}${Number(d.volt).toFixed(2)} V</span>`);
    const sub = [d.room, d.model].filter(Boolean).map((x) => this._esc(x)).join(" · ");
    return `<div class="dev${on ? " on" : ""}">
      <div class="dtop"><div class="dico">${svg(isContact ? P.door : isMotion ? P.motion : P.device, 20)}</div>
        <div class="dname"><b>${this._esc(d.name || "?")}</b>${sub ? `<span>${sub}</span>` : ""}</div>${pill}</div>
      ${mets.length ? `<div class="mets">${mets.join("")}</div>` : ""}</div>`;
  }

  _update() {
    if (!this.shadowRoot || !this._hass || !this._config) return;
    const t = this._t(), h = this._hass;
    const details = this._config.show_details !== false;
    const rows = this._entities().map((e) => {
      const st = h.states[e.entity];
      const devs = Array.isArray(st.attributes.devices) ? st.attributes.devices : null;
      return { id: e.entity, name: this._name(e), state: st.state, mode: st.attributes.mode_id, devs };
    });
    if (this._open === null) {
      const ex = this._config.expanded;
      this._open = new Set(ex === true ? rows.map((r) => r.id) : ex === "first" && rows.length ? [rows[0].id] : []);
    }
    const sensRows = (this._config.sensors || []).map((s) => (typeof s === "string" ? { entity: s } : s))
      .filter((s) => h.states[s.entity]).map((s) => {
        const st = h.states[s.entity], dc = st.attributes.device_class;
        let txt, on = false;
        if (s.entity.startsWith("binary_sensor.")) {
          on = st.state === "on";
          txt = dc === "motion" ? (on ? t.motion : t.clear) : (on ? t.open : t.closed);
        } else {
          txt = st.state + (st.attributes.unit_of_measurement ? " " + st.attributes.unit_of_measurement : "");
        }
        return { name: s.name || (st.attributes.friendly_name || s.entity).replace(/^BE WAVE \S+\s+/i, ""), txt, on };
      });
    const sig = JSON.stringify([rows, sensRows, t.arm, details]);
    if (sig === this._sig) return;
    this._sig = sig; this._rows = rows;

    const sr = this.shadowRoot;
    const armedN = rows.filter((r) => r.state.startsWith("armed")).length;
    const trig = rows.some((r) => r.state === "triggered");
    const arming = rows.some((r) => r.state === "arming" || r.state === "pending");
    let hs = "disarmed", htxt = t.all_off;
    if (!rows.length) { hs = "unknown"; htxt = t.none; }
    else if (trig) { hs = "triggered"; htxt = t.alarm_h; }
    else if (arming) { hs = "arming"; htxt = t.arming_h; }
    else if (armedN) { hs = "armed_away"; htxt = t.some_on(armedN, rows.length); }
    const head = sr.getElementById("head");
    head.className = "head" + (trig ? " alarm" : arming ? " arming" : "");
    head.style.setProperty("--c", this._color(hs));
    sr.getElementById("badge").innerHTML = this._icon(hs);
    sr.getElementById("title").textContent = this._config.title || "BE WAVE";
    sr.getElementById("status").textContent = htxt;

    sr.getElementById("modes").innerHTML = rows.map((r) => {
      const c = this._color(r.state);
      const busy = r.state === "arming" || r.state === "pending";
      const isOff = r.state === "disarmed";
      const dead = r.state === "unavailable" || r.state === "unknown";
      const label = dead ? "" : isOff ? t.arm : busy ? t.cancel : t.disarm;
      const canOpen = details && r.devs !== null;
      const open = canOpen && this._open.has(r.id);
      const devs = r.devs || [];
      const nOpen = devs.filter((d) => d.cat === "contact" && d.state === 1 && !d.bypass).length;
      const nMotion = devs.filter((d) => d.cat === "motion" && d.state === 1 && !d.bypass).length;
      const lows = devs.filter((d) => d.battery != null && d.battery <= LOW_BATTERY).map((d) => d.battery);
      const sub = [`<span class="st">${this._esc(t[r.state] || r.state)}</span>`];
      if (r.devs !== null) sub.push(`<span>${t.devs(devs.length)}</span>`);
      if (nOpen) sub.push(`<span class="w">${svg(P.warn, 14)}${t.n_open(nOpen)}</span>`);
      if (nMotion) sub.push(`<span class="w">${svg(P.warn, 14)}${t.n_motion(nMotion)}</span>`);
      if (lows.length) sub.push(`<span class="w bad">${svg(P.warn, 14)}${t.low_batt(Math.min(...lows))}</span>`);
      const body = canOpen ? `<div class="mbody"${open ? "" : " inert"}><div class="minner"><div class="mpad">
          ${devs.length ? devs.map((d) => this._devHtml(d, t)).join("") : `<div class="nodev">${t.no_devs}</div>`}
          ${r.mode ? `<div class="foot">${t.mode}: ${this._esc(r.mode)}</div>` : ""}
        </div></div></div>` : "";
      return `<section class="mode${open ? " open" : ""}${r.state === "triggered" ? " alarm" : ""}" data-id="${this._esc(r.id)}" style="--c:${c}">
        <div class="mrow">
          <button class="mtoggle" data-x="${this._esc(r.id)}" ${canOpen ? `aria-expanded="${open}" aria-label="${this._esc(r.name)} – ${t.details}"` : "disabled"}>
            <span class="ico">${this._icon(r.state)}</span>
            <span class="info"><span class="name">${this._esc(r.name)}</span><span class="sub">${sub.join("")}</span></span>
            ${canOpen ? `<span class="chev">${svg(P.chevron, 22)}</span>` : ""}
          </button>
          ${label ? `<button class="act" data-e="${this._esc(r.id)}" data-s="${isOff ? "alarm_arm_away" : "alarm_disarm"}" style="--b:${isOff ? "var(--primary-color,#03a9f4)" : c}">${label}</button>` : ""}
        </div>${body}
      </section>`;
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
    description: "Arm modes of a Satel BE WAVE panel: state, arm/disarm, expandable device details." });
}
