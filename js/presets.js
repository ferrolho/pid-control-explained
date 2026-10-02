/**
 * Preset scenarios. Each one replays a step from `from` to `to` so the response is
 * visible, and most come in pairs that differ by one thing.
 *
 * `expect` is checked by tools/validate-presets.mjs — run it after changing anything
 * here or in the simulation, and keep `behaviour` in line with what it reports.
 */

export const PRESETS = {
    'well-tuned': {
        name: 'Well-tuned',
        behaviour: 'Fast and barely overshoots: inside the ±2% band in about 1.4 s. Then the I term slowly trims away the last fraction of error.',
        kp: 15, ki: 1, kd: 6, friction: 0.5, gravity: 0, antiWindup: true, from: 30, to: 70,
        expect: { overshoot: [0, 5], settlingTime: [0.8, 2.5], steadyStateError: [0, 0.3] },
    },
    'p-only': {
        name: 'P only',
        behaviour: 'No damping from D: overshoots by more than half and rings for seconds.',
        kp: 15, ki: 0, kd: 0, friction: 0.5, gravity: 0, antiWindup: true, from: 30, to: 70,
        expect: { overshoot: [40, 80], crossings: [8, 40] },
    },
    'too-much-d': {
        name: 'Too much D',
        behaviour: 'Over-damped: no overshoot, but it crawls in, taking about four times as long to settle.',
        kp: 15, ki: 0, kd: 20, friction: 0.5, gravity: 0, antiWindup: true, from: 30, to: 70,
        expect: { overshoot: [0, 1], riseTime: [2, 6], settlingTime: [3.5, 8] },
    },
    'tilt-no-i': {
        name: 'Tilted rail, no I',
        behaviour: 'The tilt is a constant force. P and D alone stop short of the target.',
        kp: 3, ki: 0, kd: 3, friction: 0.5, gravity: -10, antiWindup: true, from: 30, to: 70,
        expect: { steadyStateError: [2.5, 4] },
    },
    'tilt-with-i': {
        name: 'Tilted rail, with I',
        behaviour: 'Same tilt and gains, plus a little I: the error is integrated away.',
        kp: 3, ki: 1, kd: 3, friction: 0.5, gravity: -10, antiWindup: true, from: 30, to: 70,
        expect: { steadyStateError: [0, 0.2] },
    },
    windup: {
        name: 'Integral windup',
        behaviour: 'Anti-windup off: I keeps growing while the force is maxed out, then overshoots.',
        kp: 15, ki: 5, kd: 5, friction: 0.5, gravity: 0, antiWindup: false, from: 15, to: 65,
        expect: { overshoot: [18, 40] },
    },
};

export function getPreset(name) {
    return PRESETS[name] ?? null;
}
