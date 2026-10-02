/**
 * 1D cart on a rail: F = ma with viscous friction, a constant force from tilting
 * the rail, and impulse disturbances that decay over time.
 *
 * State: position (0–100 along the rail) and velocity. All rates are in seconds, so
 * the simulation behaves the same at any frame rate.
 */

export class CartSimulation {
    constructor() {
        this.position = 50;
        this.velocity = 0;

        this.mass = 1.0;
        this.friction = 0.5; // viscous: force = -friction × velocity, so zero at rest
        this.gravity = 0; // constant force along the rail (tilt)

        this.minPosition = 0;
        this.maxPosition = 100;

        this.disturbanceForce = 0;
        this.disturbanceTau = 0.325; // seconds for a disturbance to decay to ~37%
    }

    /** Advance by dt seconds with the given control force (semi-implicit Euler). */
    update(controlForce, dt) {
        this.disturbanceForce *= Math.exp(-dt / this.disturbanceTau);
        if (Math.abs(this.disturbanceForce) < 0.01) this.disturbanceForce = 0;

        const totalForce = controlForce + this.disturbanceForce + this.gravity - this.friction * this.velocity;
        this.velocity += (totalForce / this.mass) * dt;
        this.position += this.velocity * dt;

        // End stops: the cart stops dead and can only move away from the wall.
        if (this.position <= this.minPosition) {
            this.position = this.minPosition;
            this.velocity = Math.max(0, this.velocity);
        } else if (this.position >= this.maxPosition) {
            this.position = this.maxPosition;
            this.velocity = Math.min(0, this.velocity);
        }
    }

    addDisturbance(force = 30) {
        this.disturbanceForce = force;
    }

    reset(position = 50) {
        this.position = position;
        this.velocity = 0;
        this.disturbanceForce = 0;
    }

    getState() {
        return { position: this.position, velocity: this.velocity, disturbance: this.disturbanceForce };
    }

    setFriction(friction) {
        this.friction = friction;
    }

    setGravity(gravity) {
        this.gravity = gravity;
    }
}
