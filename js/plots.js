/**
 * Scrolling strip charts of the last WINDOW_S seconds, drawn straight onto a canvas.
 * Replaces Chart.js: no dependency, and cheap enough to redraw every frame.
 */

export const WINDOW_S = 10;

export class StripChart {
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {object} opts
     *   series: [{ key, color, width, dash }]   values read from each sample
     *   range: [lo, hi] fixed, or 'symmetric' to autoscale around zero
     *   cap: largest autoscaled half-range (lines beyond it are clipped)
     *   band: (sample) => [lo, hi] | null       shaded band, e.g. the settling band
     *   lines: [{ y, color, dash }]             fixed horizontal guides
     */
    constructor(canvas, opts, colors) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.opts = opts;
        this.colors = colors;
        this.half = 20;
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

    yRange(samples) {
        const { range, series, cap = Infinity } = this.opts;
        if (Array.isArray(range)) return range;
        let m = 20;
        for (const s of samples) for (const { key } of series) m = Math.max(m, Math.abs(s[key]));
        const target = Math.min(cap, niceCeil(m * 1.1));
        // Ease towards the new scale so the plot doesn't jump.
        this.half += (target - this.half) * (target > this.half ? 0.35 : 0.05);
        return [-this.half, this.half];
    }

    draw(samples, now) {
        const { ctx, colors: c, opts } = this;
        const L = 40; // left gutter for y labels
        const B = 16; // bottom gutter for time labels
        const T = 8;
        const W = this.w - L - 20;
        const H = this.h - B - T;
        ctx.clearRect(0, 0, this.w, this.h);
        if (W <= 0 || H <= 0) return;

        const [lo, hi] = this.yRange(samples);
        const X = (t) => L + W * (1 - (now - t) / WINDOW_S);
        const Y = (v) => T + H * (1 - (v - lo) / (hi - lo));

        // Grid and labels.
        ctx.font = `10px ${c.mono}`;
        ctx.lineWidth = 1;
        const step = niceStep((hi - lo) / 4);
        ctx.textAlign = 'right';
        for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) {
            const y = Math.round(Y(v)) + 0.5;
            ctx.strokeStyle = Math.abs(v) < 1e-9 ? c.line2 : c.grid;
            ctx.beginPath();
            ctx.moveTo(L, y);
            ctx.lineTo(L + W, y);
            ctx.stroke();
            ctx.fillStyle = c.ink3;
            ctx.fillText(fmt(v), L - 6, y + 3);
        }
        ctx.textAlign = 'center';
        for (let k = 0; k < WINDOW_S; k += 2) {
            const x = L + W * (1 - k / WINDOW_S);
            ctx.fillStyle = c.ink3;
            ctx.fillText(k === 0 ? 'now' : `−${k}s`, x, this.h - 4);
        }

        ctx.save();
        ctx.beginPath();
        ctx.rect(L, T, W, H);
        ctx.clip();

        for (const g of opts.lines ?? []) {
            ctx.strokeStyle = c[g.color];
            ctx.setLineDash(g.dash ?? []);
            ctx.beginPath();
            ctx.moveTo(L, Y(g.y));
            ctx.lineTo(L + W, Y(g.y));
            ctx.stroke();
        }
        ctx.setLineDash([]);

        if (opts.band && samples.length > 1) {
            ctx.fillStyle = c.accentSoft;
            ctx.beginPath();
            let open = false;
            const upper = [];
            for (const s of samples) {
                const b = opts.band(s);
                if (!b) continue;
                upper.push([X(s.t), Y(b[1])]);
                if (!open) {
                    ctx.moveTo(X(s.t), Y(b[0]));
                    open = true;
                } else ctx.lineTo(X(s.t), Y(b[0]));
            }
            for (let k = upper.length - 1; k >= 0; k--) ctx.lineTo(upper[k][0], upper[k][1]);
            ctx.closePath();
            ctx.fill();
        }

        for (const { key, color, width = 1.5, dash } of opts.series) {
            ctx.strokeStyle = c[color];
            ctx.lineWidth = width;
            ctx.setLineDash(dash ?? []);
            ctx.lineJoin = 'round';
            ctx.beginPath();
            samples.forEach((s, k) => (k ? ctx.lineTo(X(s.t), Y(s[key])) : ctx.moveTo(X(s.t), Y(s[key]))));
            ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.restore();
    }
}

function niceStep(raw) {
    const p = 10 ** Math.floor(Math.log10(raw));
    const n = raw / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

function niceCeil(v) {
    const s = niceStep(v / 2);
    return Math.ceil(v / s) * s;
}

function fmt(v) {
    return Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v * 10) / 10);
}
