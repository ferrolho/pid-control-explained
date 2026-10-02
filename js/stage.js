/**
 * The cart on its rail, drawn on a canvas that fills its container.
 *
 * Besides the cart and the target, it shows what the controller is doing: the error
 * as a measured bracket, and the force as arrows — one each for P, I and D, plus the
 * net force u that actually reaches the cart (after the ±100 limit).
 */

const PAD = 34; // px between the rail ends and the canvas edges
const MAX_TILT_DEG = 6; // visual tilt at the slider's extreme
const FORCE_PX = 0.9; // px per unit of force
const FORCE_CLIP = 170; // longest arrow, in px

export class Stage {
    constructor(canvas, colors) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.colors = colors;
        this.ghosts = [];
        this.w = 0;
        this.h = 0;
        new ResizeObserver(() => this.resize()).observe(canvas);
        this.resize();
    }

    resize() {
        const r = this.canvas.getBoundingClientRect();
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        this.w = r.width;
        this.h = r.height;
        this.canvas.width = Math.round(r.width * dpr);
        this.canvas.height = Math.round(r.height * dpr);
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /** The rail's geometry for the current tilt. */
    frame(gravity) {
        // Negative gravity pulls towards 0, so the left end sits lower (counter-clockwise).
        const angle = ((gravity / 15) * MAX_TILT_DEG * Math.PI) / 180;
        const len = this.w - 2 * PAD;
        const cy = this.h * 0.62;
        return { angle, len, cx: this.w / 2, cy };
    }

    /** Map a click's x (CSS px) to a rail position 0–100, or null if off the rail. */
    positionAt(clientX, gravity) {
        const r = this.canvas.getBoundingClientRect();
        const { angle, len, cx } = this.frame(gravity);
        const along = (clientX - r.left - cx) / Math.cos(angle);
        const pos = (along / len + 0.5) * 100;
        return pos < -2 || pos > 102 ? null : Math.max(0, Math.min(100, pos));
    }

    clearTrail() {
        this.ghosts = [];
    }

    draw(s) {
        const { ctx, colors: c } = this;
        const { angle, len, cx, cy } = this.frame(s.gravity);
        const X = (p) => (p / 100 - 0.5) * len;

        ctx.clearRect(0, 0, this.w, this.h);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);

        // Rail with ticks every 10 and labels every 20.
        ctx.strokeStyle = c.line2;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(X(0), 0);
        ctx.lineTo(X(100), 0);
        ctx.stroke();
        ctx.lineWidth = 1;
        ctx.fillStyle = c.ink3;
        ctx.font = `10px ${c.mono}`;
        ctx.textAlign = 'center';
        for (let p = 0; p <= 100; p += 10) {
            ctx.beginPath();
            ctx.moveTo(X(p), 0);
            ctx.lineTo(X(p), p % 20 === 0 ? 7 : 4);
            ctx.stroke();
            if (p % 20 === 0) ctx.fillText(String(p), X(p), 20);
        }
        ctx.fillStyle = c.ink3;
        for (const p of [0, 100]) ctx.fillRect(X(p) - 2, -12, 4, 14);

        // Error bracket between the cart and the target.
        const e = s.target - s.position;
        if (Math.abs(e) > 0.6) {
            const y = 32;
            ctx.strokeStyle = c.ink3;
            ctx.beginPath();
            ctx.moveTo(X(s.position), y - 4);
            ctx.lineTo(X(s.position), y + 4);
            ctx.moveTo(X(s.position), y);
            ctx.lineTo(X(s.target), y);
            ctx.moveTo(X(s.target), y - 4);
            ctx.lineTo(X(s.target), y + 4);
            ctx.stroke();
            ctx.fillStyle = c.ink2;
            ctx.font = `italic 13px ${c.serif}`;
            ctx.fillText(`e = ${e.toFixed(1)}`, (X(s.position) + X(s.target)) / 2, y + 15);
        }

        // Target marker.
        const tx = X(s.target);
        ctx.strokeStyle = c.accent;
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(tx, -this.h * 0.5);
        ctx.lineTo(tx, 8);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = c.accent;
        ctx.beginPath();
        ctx.moveTo(tx, -4);
        ctx.lineTo(tx - 5, -12);
        ctx.lineTo(tx + 5, -12);
        ctx.fill();

        // Ghost carts: where it was over the last second.
        const x = X(s.position);
        this.ghosts.push(x);
        if (this.ghosts.length > 60) this.ghosts.shift();
        ctx.strokeStyle = c.ink3;
        this.ghosts.forEach((gx, i) => {
            if (i % 12 !== 0) return;
            ctx.globalAlpha = 0.08 + 0.18 * (i / this.ghosts.length);
            roundRect(ctx, gx - 22, -26, 44, 20, 5);
            ctx.stroke();
        });
        ctx.globalAlpha = 1;

        // The cart.
        ctx.fillStyle = c.ink;
        roundRect(ctx, x - 22, -26, 44, 20, 5);
        ctx.fill();
        ctx.fillStyle = c.bg;
        ctx.strokeStyle = c.ink;
        ctx.lineWidth = 1.5;
        for (const dx of [-12, 12]) {
            ctx.beginPath();
            ctx.arc(x + dx, -5, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }

        // Force arrows above the cart: P, I, D, then the net force u.
        const rows = [
            [s.p, c.p, 'P', 1.5],
            [s.i, c.i, 'I', 1.5],
            [s.d, c.d, 'D', 1.5],
            [s.u, s.saturated ? c.warn : c.ink, 'u', 3],
        ];
        rows.forEach(([f, color, label, width], k) => {
            const y = -44 - k * 12;
            arrow(ctx, x, y, f * FORCE_PX, color, width);
            if (Math.abs(f) * FORCE_PX > 6) {
                ctx.fillStyle = color;
                ctx.font = `${label === 'u' ? 'italic ' : ''}11px ${label === 'u' ? c.serif : c.mono}`;
                ctx.textAlign = f > 0 ? 'right' : 'left';
                ctx.fillText(label, x - Math.sign(f) * 6, y + 4);
            }
        });

        // A push from outside, in red, hitting the cart from the side it comes from.
        if (Math.abs(s.disturbance) > 0.5) {
            const dir = Math.sign(s.disturbance);
            const lenPx = Math.min(80, Math.abs(s.disturbance) * 1.6);
            const start = x - dir * (26 + lenPx);
            arrow(ctx, start, -16, dir * lenPx, c.warn, 2.5);
            ctx.fillStyle = c.warn;
            ctx.font = `11px ${c.mono}`;
            ctx.textAlign = 'center';
            ctx.fillText('push', start + (dir * lenPx) / 2, -24);
        }

        ctx.restore();

        // Gravity along the tilted rail, at the low end.
        if (Math.abs(s.gravity) > 0.01) {
            ctx.fillStyle = c.ink3;
            ctx.font = `10.5px ${c.mono}`;
            ctx.textAlign = s.gravity < 0 ? 'left' : 'right';
            ctx.fillText(
                `tilt pulls ${s.gravity < 0 ? '←' : '→'} ${Math.abs(s.gravity).toFixed(1)}`,
                s.gravity < 0 ? 12 : this.w - 12,
                18,
            );
        }
    }
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
}

/** A horizontal arrow from (x, y) of signed length `len` px, clipped with a break mark. */
function arrow(ctx, x, y, len, color, width) {
    if (Math.abs(len) < 1) return;
    const dir = Math.sign(len);
    const clipped = Math.abs(len) > FORCE_CLIP;
    const L = Math.min(Math.abs(len), FORCE_CLIP) * dir;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + L - dir * 5, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + L, y);
    ctx.lineTo(x + L - dir * 7, y - 4);
    ctx.lineTo(x + L - dir * 7, y + 4);
    ctx.fill();
    if (clipped) {
        // Two slashes: this arrow is longer than shown.
        ctx.lineWidth = 1.2;
        for (const o of [-22, -18]) {
            ctx.beginPath();
            ctx.moveTo(x + L + dir * o - 2, y + 5);
            ctx.lineTo(x + L + dir * o + 2, y - 5);
            ctx.stroke();
        }
    }
}
