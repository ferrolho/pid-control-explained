/**
 * Runs every preset headlessly, prints its step-response metrics, and fails if any
 * falls outside its `expect` ranges. Uses the app's own modules.
 *
 *   node tools/validate-presets.mjs
 */
import { PRESETS } from '../js/presets.js';
import { Runner, CONTROL_HZ } from '../js/runner.js';

const SECONDS = 15;
const fmt = (v, d = 2) => (v === null || v === undefined ? '—' : v.toFixed(d));
let failed = 0;

for (const [id, p] of Object.entries(PRESETS)) {
    const r = new Runner();
    r.pid.setGains(p.kp, p.ki, p.kd);
    r.pid.antiWindup = p.antiWindup;
    r.sim.setFriction(p.friction);
    r.sim.setGravity(p.gravity);
    r.restart(p.from, p.to);

    let crossings = 0;
    let prev = 0;
    let maxPos = -Infinity;
    for (let k = 0; k < SECONDS * CONTROL_HZ; k++) {
        const s = r.tick();
        const sign = Math.sign(s.error);
        if (sign && prev && sign !== prev) crossings++;
        if (sign) prev = sign;
        maxPos = Math.max(maxPos, s.position);
    }
    const m = { ...r.metrics, crossings };
    const problems = Object.entries(p.expect)
        .filter(([k, [lo, hi]]) => m[k] === null || m[k] < lo || m[k] > hi)
        .map(([k, [lo, hi]]) => `${k}=${fmt(m[k])} not in [${lo}, ${hi}]`);
    if (maxPos >= 99.9) problems.push('cart hit the end of the rail');
    failed += problems.length ? 1 : 0;

    console.log(
        `${problems.length ? 'FAIL' : 'ok  '} ${id.padEnd(12)} rise ${fmt(m.riseTime)}s  overshoot ${fmt(m.overshoot, 1)}%  ` +
            `settle ${fmt(m.settlingTime)}s  ss-error ${fmt(m.steadyStateError)}  crossings ${crossings}` +
            (problems.length ? `\n     ${problems.join('; ')}` : ''),
    );
}
process.exit(failed ? 1 : 0);
