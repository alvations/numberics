/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * NumbericsSettings (docs/design/REDESIGN.md 6): the one settings store, the Settings sheet and Memory (Save, Load,
 * Erase). Settings live in numberics_settings_v1 (try/catch, in-memory fallback when storage is blocked), are checked
 * field by field (a bad field falls back to its default alone), and apply live through NumbericsBoot.apply().
 * Every change fires `numberics:settings` on window (detail: the full settings) and calls the on("change") listeners
 * with (settings, changedKeys). Loaded right after kit.js; it makes NumbericsKit.reducedMotion() follow the in-app
 * Motion setting, which beats the OS (Motion "Full" plays motion even when the device asks for less).
 * Music fields: docs/design/MUSIC.md, Settings fields. Theme defaults to "auto" (the device; TRIAGE4 D5): a saved choice
 * is kept as it was. muted() / toggleMute() are the top bar's one-tap mute (TRIAGE4 D2): it turns Sound and Music off
 * together and remembers which were on (the `unmute` field), so the next tap brings back exactly those.
 * Memory never races a page's own save (TRIAGE4 B1): it flushes the batched writes before Save, and freezes the kit's
 * store (NumbericsKit.freeze) before Load or Erase writes, so no pagehide save during the reload can undo it. */
(function (w) {
  "use strict";
  var KEY = "numberics_settings_v1", PREFIX = "numberics_";
  var DEF = { v: 1, sound: true, volume: 0.5, haptics: true, motion: "auto", theme: "auto", text: "normal", contrast: "normal",
    music: true, musicVolume: 0.5, musicStyle: "auto", unmute: "both" };
  // the music styles in menu order: [id, name, blurb] (keep in step with ORDER and STYLES in music.js; a test checks it)
  var STY = [["chill", "Chill", "Slow warm keys and a lazy beat."], ["drift", "Drift", "Soft bells and a slow pad, no drums."],
    ["pocket", "Pocket", "A bright little town tune on a pocket console."], ["quest", "Quest", "A march over open country, bound for somewhere far."],
    ["blocks", "Blocks", "A quick folk dance on an old handheld chip."], ["pulse", "Pulse", "Four on the floor, a pumping pad and a bright hook."],
    ["epic", "Epic", "Big drums, brass and a long climb."]];
  var OK = { motion: ["auto", "reduced", "full"], theme: ["dark", "light", "auto"], text: ["normal", "large"], contrast: ["normal", "high"], unmute: ["both", "sound", "music"],
    musicStyle: ["auto"].concat(STY.map(function (x) { return x[0]; })) };
  var FIELDS = ["sound", "volume", "haptics", "motion", "theme", "text", "contrast", "music", "musicVolume", "musicStyle", "unmute"];

  // ---- the data: normalise field by field ----
  function normalize(raw) {
    var s = Object.assign({}, DEF), k;
    if (!raw || typeof raw !== "object") return s;
    if (typeof raw.sound === "boolean") s.sound = raw.sound;
    if (typeof raw.haptics === "boolean") s.haptics = raw.haptics;
    if (typeof raw.music === "boolean") s.music = raw.music;
    ["volume", "musicVolume"].forEach(function (k) {
      if (typeof raw[k] === "number" && isFinite(raw[k])) s[k] = Math.round(Math.max(0, Math.min(1, raw[k])) * 100) / 100;
    });
    for (k in OK) if (OK[k].indexOf(raw[k]) >= 0) s[k] = raw[k];
    return s;
  }

  // ---- storage: NumbericsKit.store when present (try/catch + memory), else the same thing here ----
  var mem = null;
  function rawGet(key) { try { return w.localStorage.getItem(key); } catch (e) { return null; } }
  function rawSet(key, val) { try { w.localStorage.setItem(key, val); return true; } catch (e) { return false; } }
  function rawDel(key) { try { w.localStorage.removeItem(key); return true; } catch (e) { return false; } }
  function rawKeys() {
    var out = [], i, n = 0;
    try { n = w.localStorage.length; } catch (e) { return out; }
    for (i = 0; i < n; i++) { var k = null; try { k = w.localStorage.key(i); } catch (e) { k = null; } if (k && k.indexOf(PREFIX) === 0) out.push(k); }
    return out;
  }
  function loadRaw() {
    var v = rawGet(KEY);
    if (v == null) v = mem;
    try { return v ? JSON.parse(v) : null; } catch (e) { return null; }
  }
  function saveRaw(s) { mem = JSON.stringify(s); rawSet(KEY, mem); }

  var cur = null;
  function current() { if (!cur) cur = normalize(loadRaw()); return cur; }
  function get() { return Object.assign({}, current()); }

  // ---- change events ----
  var subs = [];
  function on(type, fn) {
    if (type !== "change" || typeof fn !== "function") return function () {};
    subs.push(fn);
    return function () { off(type, fn); };
  }
  function off(type, fn) { var i = subs.indexOf(fn); if (i >= 0) subs.splice(i, 1); }
  function emit(changed) {
    var s = get();
    subs.slice().forEach(function (fn) { try { fn(Object.assign({}, s), changed.slice()); } catch (e) { /* one bad listener never stops the rest */ } });
    try { w.dispatchEvent(new w.CustomEvent("numberics:settings", { detail: s })); } catch (e) { /* no CustomEvent */ }
    sync();
  }
  function applyNow() { if (w.NumbericsBoot) { try { w.NumbericsBoot.apply(current()); } catch (e) { /* no DOM */ } } }

  function set(patch) {
    var before = current(), next = normalize(Object.assign({}, before, patch || {})), changed = [];
    FIELDS.forEach(function (k) { if (next[k] !== before[k]) changed.push(k); });
    cur = next; saveRaw(cur); applyNow();
    if (changed.length) emit(changed);
    return get();
  }
  // the one-tap mute: muted when neither Sound nor Music plays
  function muted() { var s = current(); return !s.sound && !s.music; }
  function toggleMute() {
    var s = current();
    if (s.sound || s.music) return set({ sound: false, music: false, unmute: s.sound && s.music ? "both" : s.sound ? "sound" : "music" });
    return set({ sound: s.unmute !== "music", music: s.unmute !== "sound" });
  }
  function reducedMotion() {
    try { return w.document.documentElement.dataset.motion === "reduced"; } catch (e) { return false; }
  }
  // the in-app setting is authoritative: the kit's helper now reads the effective motion, not the OS query
  if (w.NumbericsKit) w.NumbericsKit.reducedMotion = reducedMotion;

  // the device changed (theme or motion on "Device"): re-apply and tell listeners; another tab saved: pick it up
  function watch() {
    ["(prefers-color-scheme: light)", "(prefers-reduced-motion: reduce)"].forEach(function (q, i) {
      var m = null; try { m = w.matchMedia ? w.matchMedia(q) : null; } catch (e) { m = null; }
      try {
        if (m && m.addEventListener) m.addEventListener("change", function () {
          var s = current(), k = i ? "motion" : "theme";
          if (s[k] === "auto") { applyNow(); emit([k]); }
        });
      } catch (e) { /* old browsers */ }
    });
    try {
      w.addEventListener("storage", function (e) {
        // under /beta/ the boot shim stores our key as numberics_beta_*; a storage event names the real key
        var beta = !!(w.Storage && w.Storage.prototype && w.Storage.prototype.__nmBeta);
        if (e.key !== (beta ? "numberics_beta_" + KEY.slice(10) : KEY)) return;
        var before = current(), next; try { next = normalize(JSON.parse(e.newValue)); } catch (x) { next = normalize(null); }
        var changed = FIELDS.filter(function (k) { return next[k] !== before[k]; });
        cur = next; mem = JSON.stringify(cur); applyNow(); if (changed.length) emit(changed);
      });
    } catch (e) { /* no window events */ }
  }

  // ---- Memory: the save blob (melon-eight's encBlob: FNV-1a seed of a phrase -> xorshift keystream XOR -> base64) ----
  function keystream(seed, len) {
    var h = 2166136261 >>> 0, i;
    for (i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    var out = new Array(len), x = h || 1;
    for (i = 0; i < len; i++) { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; out[i] = x & 0xff; }
    return out;
  }
  var PHRASE = "numberics";
  function utf8(str) { return unescape(encodeURIComponent(str)); }      // a string of byte values
  function unutf8(bin) { return decodeURIComponent(escape(bin)); }
  function enc(obj) {
    var b = utf8(JSON.stringify(obj)), ks = keystream(PHRASE, b.length), s = "", i;
    for (i = 0; i < b.length; i++) s += String.fromCharCode(b.charCodeAt(i) ^ ks[i]);
    return w.btoa(s);
  }
  function dec(str) {
    var b = w.atob(str), ks = keystream(PHRASE, b.length), s = "", i;
    for (i = 0; i < b.length; i++) s += String.fromCharCode(b.charCodeAt(i) ^ ks[i]);
    return JSON.parse(unutf8(s));
  }
  function today() {
    var d = new Date();
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }
  // every numberics_* key, as the raw stored text, so a load writes back exactly what was there
  function K() { return w.NumbericsKit || null; }
  function snapshot() {
    var data = {};
    try { if (K() && K().flush) K().flush(); } catch (e) { /* nothing pending */ }
    rawKeys().forEach(function (k) { var v = rawGet(k); if (v != null) data[k] = v; });
    data[KEY] = JSON.stringify(current()); // settings travel even when storage is blocked
    return data;
  }
  function pack() { return JSON.stringify({ game: "numberics", v: 1, saved: today(), data: enc(snapshot()) }); }
  // the text of a save file -> { key: rawText } or null when it is not a Numberics save
  function unpack(text) {
    try {
      var f = JSON.parse(text);
      if (!f || f.game !== "numberics" || f.v !== 1 || typeof f.data !== "string") return null;
      var d = dec(f.data), k;
      if (!d || typeof d !== "object" || Array.isArray(d)) return null;
      for (k in d) if (k.indexOf(PREFIX) !== 0 || typeof d[k] !== "string") return null;
      return d;
    } catch (e) { return null; }
  }
  // write a loaded save: every key it holds replaces ours. False when storage refuses (nothing reloads then).
  function restore(data) {
    var ok = true, k;
    freeze();
    for (k in data) if (!rawSet(k, data[k])) ok = false;
    if (data[KEY]) { try { cur = normalize(JSON.parse(data[KEY])); mem = data[KEY]; } catch (e) { /* keep ours */ } }
    return ok;
  }
  // remove every numberics_* key except the settings (a player who needs large text keeps it)
  function wipe() { freeze(); rawKeys().forEach(function (k) { if (k !== KEY) rawDel(k); }); }
  // from the moment Memory writes until the reload, no page save reaches storage (B1); thaw() when nothing reloads
  function freeze() { try { if (K() && K().freeze) K().freeze(); } catch (e) { /* no kit */ } }
  function thaw() { try { if (K() && K().thaw) K().thaw(); } catch (e) { /* no kit */ } }
  function reload() { try { w.location.reload(); } catch (e) { /* no location */ } }
  function toast(msg) { if (w.NumbericsKit && w.NumbericsKit.toast) w.NumbericsKit.toast(msg, "info"); }

  function saveFile() {
    var text = pack(), doc = w.document;
    try {
      var url = w.URL.createObjectURL(new w.Blob([text], { type: "application/json" }));
      var a = doc.createElement("a"); a.href = url; a.download = "numberics-save.json"; a.hidden = true;
      doc.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { try { w.URL.revokeObjectURL(url); } catch (e) { /* gone */ } }, 4000);
    } catch (e) { toast("This browser cannot save a file here."); return false; }
    try { if (w.NumbericsTrophies) w.NumbericsTrophies.report("fam", "saved", {}); } catch (e) { /* trophies are optional */ }
    return true;
  }
  var BAD_FILE = "That file is not a Numberics save.";
  var BLOCKED = "This browser blocks saving, so the file could not load.";
  function apply(data) {
    if (!restore(data)) { thaw(); toast(BLOCKED); status(BLOCKED); return false; }
    reload(); return true;
  }
  // the API path (tests, scripts): load at once. The sheet's Load button asks first (confirmLoad).
  function loadText(text) {
    var data = unpack(text);
    if (!data) { bad(); return false; }
    return apply(data);
  }
  function bad() { toast(BAD_FILE); status(BAD_FILE + " Nothing changed."); }
  function savedOn(text) { try { var f = JSON.parse(text); return typeof f.saved === "string" && /^\d{4}-\d\d-\d\d$/.test(f.saved) ? f.saved : ""; } catch (e) { return ""; } }
  function loadFile(file) {
    if (!file) return;
    try {
      var r = new w.FileReader();
      r.onload = function () { var t = String(r.result || ""), d = unpack(t); if (!d) bad(); else confirmLoad(d, savedOn(t)); };
      r.onerror = function () { bad(); };
      r.readAsText(file);
    } catch (e) { bad(); }
  }
  function erase() { wipe(); reload(); }
  // the Memory line under the buttons: a plain status (role=status), or the Load confirm
  function status(msg) {
    var el = X && X.isConnected ? X.querySelector("[data-memst]") : null; if (!el) return;
    el.textContent = msg || ""; el.hidden = !msg;
  }
  function confirmLoad(data, day) {
    var el = X && X.isConnected ? X.querySelector("[data-memst]") : null;
    if (!el) { apply(data); return; }
    el.hidden = false;
    el.innerHTML = '<span class="memq">Load the save' + (day ? " from " + day : "") + "? It replaces the games, bests and trophies it holds.</span>" +
      '<span class="mem2"><button class="btn primary" type="button" data-mem="yes">Load it</button><button class="btn" type="button" data-mem="no">Cancel</button></span>';
    var yes = el.querySelector('[data-mem="yes"]');
    yes.addEventListener("click", function () { tick(); apply(data); });
    el.querySelector('[data-mem="no"]').addEventListener("click", function () {
      tick(); status(""); var l = X && X.querySelector('[data-mem="load"]'); if (l) l.focus();
    });
    try { yes.focus({ preventScroll: false }); } catch (e) { yes.focus(); }
  }

  // ---- the Settings sheet (REDESIGN.md 6.2), inside NumbericsUI.sheet ----
  var X = null; // the open sheet's controls, for sync()
  function tick() { try { if (w.NumbericsAudio) w.NumbericsAudio.tick(); } catch (e) { /* silent */ } }
  function hasVibrate() { try { return !!(w.navigator && typeof w.navigator.vibrate === "function"); } catch (e) { return false; } }
  function sw(field, name, sub, on) {
    if (on === false) return ""; // no row at all (a [hidden] .set would still show: .set sets display)
    return '<div class="set"><div class="lbl"><b>' + name + "</b>" + (sub ? "<small>" + sub + "</small>" : "") +
      '</div><button class="sw" role="switch" aria-checked="false" type="button" aria-label="' + name + '" data-sw="' + field + '"></button></div>';
  }
  function seg(field, name, opts) {
    return '<div class="set"><div class="lbl"><b>' + name + '</b></div><div class="seg3" role="group" aria-label="' + name + '">' +
      opts.map(function (o) { return '<button type="button" aria-pressed="false" data-seg="' + field + '" data-v="' + o[0] + '">' + o[1] + "</button>"; }).join("") +
      "</div></div>";
  }
  var SWITCH = { sound: [true, false], music: [true, false], haptics: [true, false], text: ["large", "normal"], contrast: ["high", "normal"] };
  function range(attr, name) {
    return '<div class="set"><div class="lbl" style="flex:1"><b>' + name + '</b><input class="vol" type="range" min="0" max="100" step="5" aria-label="' + name + '" ' + attr + "></div></div>";
  }
  function build(el) {
    el.innerHTML =
      '<div class="sec">Sound and feel</div>' +
      sw("sound", "Sound", "Soft clicks and chimes") +
      range("data-vol", "Volume") +
      sw("music", "Music", "Quiet tunes while you play") + range("data-mvol", "Music volume") +
      '<div class="set" data-mstyle style="flex-direction:column;align-items:stretch"><div class="lbl"><b>Music style</b></div>' +
      '<div class="seg3" role="group" aria-label="Music style" style="grid-auto-flow:row;grid-template-columns:repeat(4,1fr)">' +
      [["auto", "Auto (per\u00a0game)", "Each game picks its own"]].concat(STY).map(function (o) {
        return '<button type="button" aria-pressed="false" data-seg="musicStyle" data-v="' + o[0] + '" title="' + o[2] + '" style="padding:0 4px">' + o[1] + "</button>";
      }).join("") + "</div></div>" +
      sw("haptics", "Vibration", "On phones that support it", hasVibrate()) +
      '<div class="sec">Seeing</div>' +
      seg("motion", "Motion", [["auto", "Device"], ["reduced", "Less"], ["full", "Full"]]) +
      seg("theme", "Theme", [["dark", "Dark"], ["light", "Light"], ["auto", "Device"]]) +
      sw("text", "Larger text") + sw("contrast", "High contrast") +
      '<div class="sec">Memory</div>' +
      '<p style="margin:2px 0 8px;color:var(--mute);font-size:var(--fs-sm)">Your games, bests and trophies live on this device. Save them to a file to move them to another one; Load puts a saved file back.</p>' +
      '<div class="mem"><button class="btn" type="button" data-mem="save">Save</button><button class="btn" type="button" data-mem="load">Load</button>' +
      '<button class="btn danger" type="button" data-mem="erase">Erase</button></div>' +
      '<div class="memst" role="status" aria-live="polite" data-memst hidden></div>' +
      '<input type="file" accept=".json,application/json" hidden data-file>';
    X = el;
    Array.prototype.forEach.call(el.querySelectorAll("[data-sw]"), function (b) {
      b.addEventListener("click", function () {
        var f = b.getAttribute("data-sw"), p = {}, on = b.getAttribute("aria-checked") !== "true";
        p[f] = SWITCH[f][on ? 0 : 1]; set(p); tick();
      });
    });
    Array.prototype.forEach.call(el.querySelectorAll("[data-seg]"), function (b) {
      b.addEventListener("click", function () { var p = {}; p[b.getAttribute("data-seg")] = b.getAttribute("data-v"); set(p); tick(); });
    });
    var vol = el.querySelector("[data-vol]");
    vol.addEventListener("input", function () { set({ volume: +vol.value / 100 }); tick(); });
    var mv = el.querySelector("[data-mvol]"); // no preview tick: the music itself is the preview
    mv.addEventListener("input", function () { set({ musicVolume: +mv.value / 100 }); });
    var file = el.querySelector("[data-file]");
    file.addEventListener("change", function () { loadFile(file.files && file.files[0]); file.value = ""; });
    el.querySelector('[data-mem="save"]').addEventListener("click", function () { tick(); saveFile(); });
    el.querySelector('[data-mem="load"]').addEventListener("click", function () { tick(); status(""); file.click(); });
    var er = el.querySelector('[data-mem="erase"]');
    if (w.NumbericsKit && w.NumbericsKit.twoStep) w.NumbericsKit.twoStep(er, function () { return true; }, erase, "Sure? Erase everything");
    else er.addEventListener("click", erase);
    sync();
  }
  // reflect the current settings in the open sheet (after a change here, in another tab, or on the device)
  function sync() {
    if (!X || !X.isConnected) { X = null; return; }
    var s = current();
    Array.prototype.forEach.call(X.querySelectorAll("[data-sw]"), function (b) {
      var f = b.getAttribute("data-sw"); b.setAttribute("aria-checked", String(s[f] === SWITCH[f][0]));
    });
    Array.prototype.forEach.call(X.querySelectorAll("[data-seg]"), function (b) {
      b.setAttribute("aria-pressed", String(s[b.getAttribute("data-seg")] === b.getAttribute("data-v")));
    });
    [["[data-vol]", s.volume], ["[data-mvol]", s.musicVolume]].forEach(function (r) {
      var el = X.querySelector(r[0]), v = String(Math.round(r[1] * 100));
      if (el && el.value !== v) el.value = v;
    });
    var mv = X.querySelector("[data-mvol]"), ms = X.querySelector("[data-mstyle]");
    if (mv) mv.disabled = !s.music;
    if (ms) ms.style.display = s.music ? "" : "none"; // not [hidden]: .set sets display
  }
  function open() {
    if (!w.NumbericsUI || !w.NumbericsUI.sheet) return null;
    return w.NumbericsUI.sheet("settings", build, { title: "Settings", onClose: function () { X = null; } });
  }

  watch();
  w.NumbericsSettings = {
    KEY: KEY, DEFAULTS: DEF, STYLES: STY.map(function (x) { return { id: x[0], name: x[1], blurb: x[2] }; }), get: get, set: set, on: on, off: off, muted: muted, toggleMute: toggleMute, reducedMotion: reducedMotion, open: open, normalize: normalize,
    memory: { pack: pack, unpack: unpack, snapshot: snapshot, restore: restore, loadText: loadText, confirmLoad: confirmLoad, save: saveFile, erase: erase, wipe: wipe,
      enc: enc, dec: dec, BAD_FILE: BAD_FILE }
  };
})(typeof window !== "undefined" ? window : this);
