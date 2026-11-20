/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Runs every tests/test*.js in its own process. `node tests/run.js [name-filter]` */
"use strict";
const fs = require("fs"), path = require("path"), { spawnSync } = require("child_process");
const want = process.argv[2] || "";
const files = fs.readdirSync(__dirname).filter(f => /^test.*\.js$/.test(f) && f.includes(want)).sort();
let bad = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], { encoding: "utf8" });
  const last = (r.stdout || "").trim().split("\n").pop();
  console.log(f.padEnd(24), last);
  if (r.status !== 0) { bad++; process.stdout.write((r.stdout || "") + (r.stderr || "")); }
}
process.exit(bad ? 1 : 0);
