/**
 * PID controller: u = Kp·e + Ki·∫e dt − Kd·dx/dt
 *
 * - Derivative on measurement, so a setpoint jump doesn't cause a derivative kick.
 * - Output saturation at ±100.
 * - Anti-windup by conditional integration: while the output is saturated, the
 *   integral only accumulates if that would pull the output back out of saturation.
 */

export class PIDController {
    constructor(kp = 1.0, ki = 0.0, kd = 0.0) {
        this.kp = kp;
        this.ki = ki;
        this.kd = kd;

        this.integral = 0;
        this.previousMeasurement = null;

        this.outputMin = -100;
        this.outputMax = 100;
        this.antiWindup = true;
    }

    /**
     * @param {number} error setpoint − measurement
     * @param {number} measurement current position
     * @param {number} dt seconds since the last update
     * @returns {{output:number, pTerm:number, iTerm:number, dTerm:number, saturated:boolean}}
     */
    update(error, measurement, dt) {
        const pTerm = this.kp * error;

        let dTerm = 0;
        if (this.previousMeasurement !== null) {
            dTerm = (-this.kd * (measurement - this.previousMeasurement)) / dt;
        }
        this.previousMeasurement = measurement;

        const candidate = this.integral + error * dt;
        const unsaturated = pTerm + this.ki * candidate + dTerm;
        const pushingHigh = unsaturated > this.outputMax && error > 0;
        const pushingLow = unsaturated < this.outputMin && error < 0;
        if (!this.antiWindup || !(pushingHigh || pushingLow)) this.integral = candidate;

        const iTerm = this.ki * this.integral;
        const raw = pTerm + iTerm + dTerm;
        const output = Math.max(this.outputMin, Math.min(this.outputMax, raw));

        return { output, pTerm, iTerm, dTerm, saturated: output !== raw };
    }

    reset() {
        this.integral = 0;
        this.previousMeasurement = null;
    }

    setGains(kp, ki, kd) {
        this.kp = kp;
        this.ki = ki;
        this.kd = kd;
    }

    getGains() {
        return { kp: this.kp, ki: this.ki, kd: this.kd };
    }
}
