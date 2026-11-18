// Runs every offline test suite, several times in a row, to catch failures that only show up
// now and then. Stops at the first failing run and prints its output. Free and offline.
//
// Usage (after npm run build):
//   npm test                          # each suite once
//   npm run test:loop                 # each suite 5 times
//   node scripts/test-loop.mjs 20     # each suite 20 times
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const runs = Math.max(1, Number.parseInt(process.argv[2] ?? "1", 10) || 1);
const script = (name) => fileURLToPath(new URL(`./${name}`, import.meta.url));
const SUITES = [
  ["smoke (Tiled coordinates)", [script("smoke-test.mjs")]],
  ["smoke (legacy screen coordinates)", [script("smoke-test.mjs"), "screen"]],
  ["hosted mode over HTTP", [script("smoke-http.mjs")]],
];

const started = Date.now();
for (let run = 1; run <= runs; run++) {
  for (const [label, args] of SUITES) {
    const t0 = Date.now();
    const r = spawnSync(process.execPath, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    const summary = (r.stdout.match(/(\d+) passed, (\d+) failed/) ?? [])[0] ?? "no summary";
    const seconds = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`run ${run}/${runs}  ${label.padEnd(34)} ${summary}  (${seconds} s)`);
    if (r.status !== 0) {
      console.log(r.stdout.split("\n").filter((l) => !l.startsWith("PASS")).join("\n"));
      if (r.stderr.trim()) console.log(r.stderr.slice(0, 2000));
      console.log(`\nFailed on run ${run} of ${runs}: ${label}.`);
      process.exit(1);
    }
  }
}
console.log(`\nAll ${SUITES.length} suites passed ${runs} time(s) in ${((Date.now() - started) / 1000).toFixed(0)} s.`);
