/**
 * Step-response metrics, measured live from samples.
 *
 *   Rise time      — time from 10% to 90% of the step.
 *   Overshoot      — largest excursion past the target, as % of the step.
 *   Settling time  — from the step until the cart enters and then stays within
 *                    ±2% of the step size around the target (confirmed after 1 s).
 *   Steady-state   — |target − position| once the cart has come to rest
 *   error            (|velocity| < 0.05 for 1 s), whether or not it settled in the band.
 */

const SETTLE_CONFIRM_S = 1.0;
const REST_CONFIRM_S = 1.0;
const REST_SPEED = 0.05;

export class StepMetrics {
    constructor() {
        this.start(0, 0, 0);
    }

    /** Begin tracking a new step from `position` to `target` at time `t`. */
    start(t, position, target) {
        this.t0 = t;
        this.x0 = position;
        this.target = target;
        this.step = target - position;
        this.valid = Math.abs(this.step) >= 1;
        this.t10 = null;
        this.t90 = null;
        this.peak = 0;
        this.inBandSince = null;
        this.restSince = null;
        this.riseTime = null;
        this.overshoot = null;
        this.settlingTime = null;
        this.steadyStateError = null;
    }

    update(t, position, velocity) {
        if (!this.valid) return this;
        const dir = Math.sign(this.step);
        const progress = ((position - this.x0) * dir) / Math.abs(this.step); // 0 → 1
        const error = this.target - position;

        if (this.t10 === null && progress >= 0.1) this.t10 = t;
        if (this.t90 === null && progress >= 0.9) {
            this.t90 = t;
            this.riseTime = this.t90 - (this.t10 ?? this.t0);
        }

        const past = (position - this.target) * dir;
        if (past > this.peak) this.peak = past;
        if (this.t90 !== null) this.overshoot = (100 * this.peak) / Math.abs(this.step);

        const band = 0.02 * Math.abs(this.step);
        if (Math.abs(error) <= band) {
            if (this.inBandSince === null) this.inBandSince = t;
            if (t - this.inBandSince >= SETTLE_CONFIRM_S) this.settlingTime = this.inBandSince - this.t0;
        } else {
            this.inBandSince = null;
            this.settlingTime = null;
        }

        if (Math.abs(velocity) < REST_SPEED) {
            if (this.restSince === null) this.restSince = t;
            if (t - this.restSince >= REST_CONFIRM_S) this.steadyStateError = Math.abs(error);
        } else {
            this.restSince = null;
            this.steadyStateError = null;
        }
        return this;
    }
}
