# PID Control, Explained

**[Live demo →](https://ferrolho.github.io/pid-control-explained/)**

An interactive explanation of PID control. Tune P, I, and D on a simulated cart and watch what each term does: in the cart's force arrows, in live plots of position and control force, and in step-response metrics. A slide-over **Learn** panel explains every concept, and anything clickable on the page opens it at that topic.

## The system

A cart slides along a rail (positions 0–100). The controller applies one force, limited to ±100. The cart obeys *F = ma* with viscous friction, and tilting the rail adds a constant force along it. **Push cart** adds a sudden disturbance that decays over a third of a second.

## The controller

```
u = Kp·e + Ki·∫e dt − Kd·dx/dt        e = target − position
```

- **Derivative on measurement**, so moving the target doesn't cause a derivative kick.
- **Output limit** of ±100.
- **Anti-windup** by conditional integration: while the output is saturated, the integral only grows if that pulls the output back out. Switch it off to see windup.
- **Fixed clock:** the controller runs at 100 Hz and holds its output between updates; the physics integrates at 1 kHz. Both are independent of the display's refresh rate.

## Presets

Each preset replays a step response; most come in pairs that differ in one thing. `node tools/validate-presets.mjs` simulates them headlessly and fails if one stops behaving as described:

| Preset | Kp / Ki / Kd | What it shows |
|---|---|---|
| Well-tuned | 15 / 1 / 6 | 1.7% overshoot, settles in 1.35 s |
| P only | 15 / 0 / 0 | 60% overshoot, rings for seconds |
| Too much D | 15 / 0 / 20 | No overshoot, but takes 5.3 s to settle |
| Tilted rail, no I | 3 / 0 / 3 | Stops 3.3 short of the target |
| Tilted rail, with I | 3 / 1 / 3 | Same tilt, error integrated away |
| Integral windup | 15 / 5 / 5, anti-windup off | 26% overshoot after saturating (6.6% with it on) |

`?preset=<id>` in the URL opens a preset directly, and `?theme=light|dark` overrides the system theme (used when embedded).

## Metrics

- **Rise time:** from 10% to 90% of the step.
- **Overshoot:** the largest excursion past the target, as a percentage of the step.
- **Settling time:** until the cart enters and stays within ±2% of the step (confirmed after 1 s).
- **Steady-state error:** once the cart has been at rest for 1 s.

## Files

| File | What |
|---|---|
| `js/simulation.js`, `js/pid-controller.js` | The cart and the controller |
| `js/runner.js` | Couples them on the fixed clock |
| `js/metrics.js` | Step-response metrics |
| `js/presets.js` | Presets, with the ranges the validator checks |
| `js/stage.js`, `js/plots.js` | Canvas drawing: the cart, and the scrolling plots |
| `js/learn.js`, `js/educational-content.js` | The Learn panel and its content |
| `js/app.js` | Wires it all to the page |
| `styles/app.css` | Light and dark themes |

No build step and no dependencies: plain ES modules, served as static files.

## Run locally

```bash
python3 -m http.server 8000      # then open http://localhost:8000
node tools/validate-presets.mjs  # check the presets
```

GitHub Pages serves the `main` branch as is.

## References

- K. J. Åström and R. M. Murray, *Feedback Systems: An Introduction for Scientists and Engineers*, 2nd ed., 2021.
- G. F. Franklin, J. D. Powell, and A. Emami-Naeini, *Feedback Control of Dynamic Systems*, 8th ed., 2019.

## Licence

MIT — see [LICENSE](LICENSE).
