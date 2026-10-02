/**
 * Couples the controller to the cart at a fixed rate, independent of the display.
 *
 * The controller runs at CONTROL_HZ and holds its output between updates (like a
 * real digital controller); the physics integrates at PHYSICS_HZ in between.
 */

import { PIDController } from './pid-controller.js';
import { CartSimulation } from './simulation.js';
import { StepMetrics } from './metrics.js';

export const CONTROL_HZ = 100;
const PHYSICS_SUBSTEPS = 10;

export class Runner {
    constructor() {
        this.pid = new PIDController(8, 3, 5);
        this.sim = new CartSimulation();
        this.metrics = new StepMetrics();
        this.target = 50;
        this.time = 0;
        this.last = null;
    }

    get dt() {
        return 1 / CONTROL_HZ;
    }

    setTarget(target) {
        this.target = target;
        this.metrics.start(this.time, this.sim.position, target);
    }

    /** Put the cart at `from`, clear the controller, and command a step to `to`. */
    restart(from, to) {
        this.sim.reset(from);
        this.pid.reset();
        this.time = 0;
        this.last = null;
        this.setTarget(to);
    }

    /** Advance one control period; returns the sample for plotting. */
    tick() {
        const dt = this.dt;
        const position = this.sim.position;
        const error = this.target - position;
        const { output, pTerm, iTerm, dTerm, saturated } = this.pid.update(error, position, dt);
        for (let i = 0; i < PHYSICS_SUBSTEPS; i++) this.sim.update(output, dt / PHYSICS_SUBSTEPS);
        this.time += dt;
        const s = this.sim.getState();
        this.metrics.update(this.time, s.position, s.velocity);
        this.last = {
            t: this.time,
            target: this.target,
            position: s.position,
            velocity: s.velocity,
            error: this.target - s.position,
            u: output,
            p: pTerm,
            i: iTerm,
            d: dTerm,
            saturated,
            disturbance: s.disturbance,
            gravity: this.sim.gravity,
        };
        return this.last;
    }
}
