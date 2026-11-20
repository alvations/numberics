/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Repo conventions every game must pass. Usage in a test file:
 *   require("./conventions")(t, ok, ["seven/engine.js", "seven/game.js", "seven/index.html", "seven/style.css"]); */
"use strict";
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
module.exports = function (t, ok, rel) {
  const files = rel.map(f => [f, fs.readFileSync(path.join(root, f), "utf8")]);
  t("conventions: SPDX header in every file", () => files.forEach(([f, s]) => ok(/SPDX-License-Identifier: Apache-2\.0/.test(s), f)));
  t("conventions: no document.write, eval or new Function", () => files.forEach(([f, s]) => {
    ok(!/document\.write/.test(s), f + " document.write"); ok(!/\beval\s*\(/.test(s), f + " eval"); ok(!/new\s+Function\s*\(/.test(s), f + " Function");
  }));
  t("conventions: no em-dashes", () => files.forEach(([f, s]) => ok(!/—/.test(s), f)));
  t("conventions: no CDN or external requests", () => files.forEach(([f, s]) => ok(!/(src|href)\s*=\s*["']https?:/.test(s) && !/https?:\/\/(cdn|unpkg|cdnjs|fonts\.)/.test(s), f)));
  t("conventions: every localStorage call sits inside a try", () => files.forEach(([f, s]) => {
    const lines = s.split("\n");
    lines.forEach((ln, i) => { if (/localStorage\./.test(ln)) ok(/try\s*\{/.test(lines.slice(Math.max(0, i - 2), i + 1).join(" ")), f + ":" + (i + 1)); });
  }));
  t("conventions: page links the shared theme, kit and nav, and has a toast", () => files.filter(([f]) => f.endsWith("index.html")).forEach(([f, s]) => {
    ok(/shared\/theme\.css/.test(s), f + " theme"); ok(/shared\/kit\.js/.test(s), f + " kit"); ok(/shared\/nav\.js/.test(s), f + " nav");
    ok(/id="toast"/.test(s), f + " toast"); ok(/<title>[^<]+<\/title>/.test(s), f + " title");
  }));
};
