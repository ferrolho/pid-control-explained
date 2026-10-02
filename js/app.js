/**
 * PID Control, Explained — wires the simulation to the page.
 *
 * The controller and physics advance on a fixed clock (see runner.js); each animation
 * frame runs however many control ticks of real time have passed, then redraws.
 */

import { Runner, CONTROL_HZ } from './runner.js';
import { PRESETS, getPreset } from './presets.js';
import { Stage } from './stage.js';
import { StripChart, WINDOW_S } from './plots.js';
import { Learn } from './learn.js';

const AUTO_STEP_S = 6;
const PUSH_FORCE = 40;
const MAX_TICKS_PER_FRAME = 20;

const $ = (id) => document.getElementById(id);

function readColors() {
    const cs = getComputedStyle(document.documentElement);
    const v = (n) => cs.getPropertyValue(n).trim();
    return {
        bg: v('--bg'),
        ink: v('--ink'),
        ink2: v('--ink-2'),
        ink3: v('--ink-3'),
        line2: v('--line-2'),
        grid: v('--grid'),
        accent: v('--accent'),
        accentSoft: v('--accent-soft'),
        p: v('--p'),
        i: v('--i'),
        d: v('--d'),
        warn: v('--warn'),
        mono: v('--font-mono'),
        serif: v('--font-serif'),
    };
}

class App {
    constructor() {
        this.runner = new Runner();
        this.samples = [];
        this.running = true;
        this.preset = null;
        this.lastStep = { from: 30, to: 70 };
        this.autoTimer = 0;

        // Shared by reference, so a theme change recolours everything in place.
        this.colors = readColors();
        this.stage = new Stage($('stage'), this.colors);
        this.position = new StripChart(
            $('plot-position'),
            {
                range: [0, 100],
                series: [
                    { key: 'target', color: 'accent', width: 1.5, dash: [5, 4] },
                    { key: 'position', color: 'ink', width: 2 },
                ],
                band: (s) => (s.band ? [s.target - s.band, s.target + s.band] : null),
            },
            this.colors,
        );
        this.force = new StripChart(
            $('plot-force'),
            {
                range: 'symmetric',
                cap: 400,
                series: [
                    { key: 'p', color: 'p', width: 1.25 },
                    { key: 'i', color: 'i', width: 1.25 },
                    { key: 'd', color: 'd', width: 1.25 },
                    { key: 'u', color: 'ink', width: 2.25 },
                ],
                lines: [
                    { y: 100, color: 'warn', dash: [3, 3] },
                    { y: -100, color: 'warn', dash: [3, 3] },
                ],
            },
            this.colors,
        );
        new Learn();

        this.buildPresets();
        this.bind();
        const fromUrl = new URLSearchParams(location.search).get('preset');
        this.applyPreset(PRESETS[fromUrl] ? fromUrl : 'well-tuned');

        matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () =>
            Object.assign(this.colors, readColors()),
        );
        document.fonts?.ready.then(() => Object.assign(this.colors, readColors()));

        this.last = performance.now();
        this.acc = 0;
        requestAnimationFrame((t) => this.frame(t));
    }

    // ───────── Controls ─────────

    buildPresets() {
        $('presets').innerHTML = Object.entries(PRESETS)
            .map(([id, p]) => `<button class="preset" data-preset="${id}" aria-pressed="false">${p.name}</button>`)
            .join('');
        $('presets').addEventListener('click', (e) => {
            const b = e.target.closest('[data-preset]');
            if (b) this.applyPreset(b.dataset.preset);
        });
    }

    bind() {
        const gain = (id, key) => {
            $(id).addEventListener('input', (e) => {
                this.runner.pid[key] = parseFloat(e.target.value);
                this.showGains();
                this.markCustom();
            });
        };
        gain('kp', 'kp');
        gain('ki', 'ki');
        gain('kd', 'kd');

        $('target').addEventListener('input', (e) => this.setTarget(parseFloat(e.target.value)));
        $('tilt').addEventListener('input', (e) => {
            this.runner.sim.setGravity(parseFloat(e.target.value));
            this.showScenario();
            this.markCustom();
        });
        $('antiwindup').addEventListener('change', (e) => {
            this.runner.pid.antiWindup = e.target.checked;
            this.markCustom();
        });
        $('autostep').addEventListener('change', (e) => {
            this.autoTimer = 0;
            $('target').disabled = e.target.checked;
        });

        $('stage').addEventListener('click', (e) => {
            if ($('autostep').checked) return;
            const pos = this.stage.positionAt(e.clientX, this.runner.sim.gravity);
            if (pos !== null) this.setTarget(Math.round(Math.max(5, Math.min(95, pos))));
        });

        $('play-btn').addEventListener('click', () => {
            this.running = !this.running;
            $('play-btn').setAttribute('aria-pressed', String(this.running));
            $('play-btn').innerHTML = this.running ? '<span class="ico">❚❚</span> Pause' : '<span class="ico">▶</span> Play';
            this.last = performance.now();
        });
        $('replay-btn').addEventListener('click', () => this.restart(this.lastStep.from, this.lastStep.to));
        $('push-btn').addEventListener('click', () =>
            this.runner.sim.addDisturbance((Math.random() < 0.5 ? -1 : 1) * PUSH_FORCE),
        );
    }

    applyPreset(id) {
        const p = getPreset(id);
        if (!p) return;
        this.preset = id;
        const { pid, sim } = this.runner;
        pid.setGains(p.kp, p.ki, p.kd);
        pid.antiWindup = p.antiWindup;
        sim.setFriction(p.friction);
        sim.setGravity(p.gravity);
        $('kp').value = p.kp;
        $('ki').value = p.ki;
        $('kd').value = p.kd;
        $('tilt').value = p.gravity;
        $('antiwindup').checked = p.antiWindup;
        this.showGains();
        this.restart(p.from, p.to);
        document.querySelectorAll('.preset').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === id)));
        $('preset-note').textContent = p.behaviour;
    }

    markCustom() {
        if (!this.preset) return;
        this.preset = null;
        document.querySelectorAll('.preset').forEach((b) => b.setAttribute('aria-pressed', 'false'));
        $('preset-note').textContent = 'Custom settings. Replay the step to see how they respond.';
    }

    /** Put the cart back at `from` and command a step to `to`, clearing the plots. */
    restart(from, to) {
        this.runner.restart(from, to);
        this.lastStep = { from, to };
        this.autoPair = { from, to };
        this.samples = [];
        this.stage.clearTrail();
        this.autoTimer = 0;
        $('target').value = to;
        this.showScenario();
        this.showMetrics();
    }

    setTarget(target) {
        this.lastStep = { from: Math.round(this.runner.sim.position), to: target };
        this.runner.setTarget(target);
        $('target').value = target;
        this.showScenario();
    }

    showGains() {
        const { kp, ki, kd } = this.runner.pid;
        $('kp-out').textContent = kp.toFixed(1);
        $('ki-out').textContent = ki.toFixed(2);
        $('kd-out').textContent = kd.toFixed(1);
    }

    showScenario() {
        $('target-out').textContent = Math.round(this.runner.target);
        const g = this.runner.sim.gravity;
        $('tilt-out').textContent = g === 0 ? 'level' : `${g > 0 ? '+' : '−'}${Math.abs(g).toFixed(1)}`;
    }

    showMetrics() {
        const m = this.runner.metrics;
        const set = (id, v, unit, d = 2) => {
            const el = $(id);
            el.textContent = v === null ? '—' : `${v.toFixed(d)}${unit}`;
            el.classList.toggle('pending', v === null);
        };
        set('m-rise', m.riseTime, ' s');
        set('m-overshoot', m.overshoot, '%', 1);
        set('m-settle', m.settlingTime, ' s');
        set('m-sse', m.steadyStateError, '');
    }

    // ───────── Loop ─────────

    frame(now) {
        const elapsed = Math.min(0.25, (now - this.last) / 1000);
        this.last = now;

        if (this.running) {
            this.acc += elapsed;
            const dt = 1 / CONTROL_HZ;
            let ticks = 0;
            while (this.acc >= dt && ticks < MAX_TICKS_PER_FRAME) {
                if ($('autostep').checked && (this.autoTimer += dt) >= AUTO_STEP_S) {
                    this.autoTimer = 0;
                    const { from, to } = this.autoPair;
                    this.setTarget(Math.abs(this.runner.target - to) < 0.5 ? from : to);
                }
                const s = this.runner.tick();
                s.band = this.runner.metrics.valid ? 0.02 * Math.abs(this.runner.metrics.step) : 0;
                this.samples.push(s);
                this.acc -= dt;
                ticks++;
            }
            if (ticks === MAX_TICKS_PER_FRAME) this.acc = 0;
            const cutoff = this.runner.time - WINDOW_S - 0.1;
            while (this.samples.length && this.samples[0].t < cutoff) this.samples.shift();
        }

        const s = this.runner.last;
        if (s) {
            this.stage.draw(s);
            this.position.draw(this.samples, this.runner.time);
            this.force.draw(this.samples, this.runner.time);
            if (!this.legendAt || now - this.legendAt > 100) {
                this.legendAt = now;
                $('l-target').textContent = s.target.toFixed(1);
                $('l-position').textContent = s.position.toFixed(1);
                const f = (v) => (Math.abs(v) < 0.5 ? '0' : v.toFixed(0));
                $('l-u').textContent = f(s.u);
                $('l-p').textContent = f(s.p);
                $('l-i').textContent = f(s.i);
                $('l-d').textContent = f(s.d);
                this.showMetrics();
            }
        }
        requestAnimationFrame((t) => this.frame(t));
    }
}

new App();
