# quantum_ascii

**do you want to explore the universe?**

A front-end ASCII animation. A hand rises out of the dark, opens to reveal a
spark, then closes around it. The light leaks through its fingers, collapses to
a point, and goes off in a big bang. The debris spirals into a disk that forms
the Sun and nine worlds (Pluto included), which then orbit live. Click any body
to read about it.

Everything is drawn as coloured characters on a single `<canvas>`. Plain
HTML/CSS/JS, no build step, no dependencies.

## Run it

Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Controls

| | |
|---|---|
| scroll / swipe / click / Enter | begin |
| `skip ›` | jump to the finished solar system |
| click a planet or the Sun | show its facts |
| ← / → | step through the bodies |
| Esc | close the panel |
| `↺ witness it again` or `R` | replay the film from the start |
| `sound on/off` | toggle the soundtrack (synthesised live with WebAudio) |

## How it works

- `js/main.js` keeps a brightness + colour value for every character cell. Each
  frame, the scene (stars, hand, glow, particles, sun, planets) is lit into that
  buffer, then every cell is stamped with a glyph from a pre-rendered atlas
  (`' .,:;-~=+*oxX#%@'`, brighter means denser).
- The whole film is a pure function of the timeline `t` with seeded randomness,
  so every replay plays exactly the same.
- The hand is built from tapered capsules (three per finger) whose joint angles
  follow a single curl value, from open (0) to a fist (1).
- `js/audio.js` generates the drone, riser, bang and ambient pad with WebAudio.
- `js/data.js` holds the facts shown for each body.
