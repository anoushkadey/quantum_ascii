# quantum_ascii

**do you want to explore the universe?**

A front-end ASCII animation. The history of the universe types itself out
line by line, a single point of light gathers in the dark, and then the big
bang goes off in a strobing white-out. The debris spirals into a disk that
forms the Sun and nine worlds (Pluto included). The camera pulls in to a
close "half universe" view, and from there you can orbit the whole system in
3D, zoom in, and fly to any world to read about it.

> Photosensitivity warning: the big bang contains intense flashing light.
> The strobe is reduced when the system's "reduce motion" setting is on.

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
| drag | orbit the camera around the system |
| scroll / pinch | zoom |
| click a planet or the Sun | fly to it and show its age and a fact |
| ← / → | step through the bodies |
| Esc / `pull back` | return to the whole system |
| `↺ replay` or `R` | back to the opening question |
| `sound on/off` | toggle the soundtrack (synthesised live with WebAudio) |

## How it works

- `js/main.js` keeps a brightness + colour value for every character cell. Each
  frame, the scene (stars, the point of light, particles, sun, planets) is lit into that
  buffer, then every cell is stamped with a glyph from a pre-rendered atlas
  (`' .,:;-~=+*oxX#%@'`, brighter means denser).
- The whole film is a pure function of the timeline `t` with seeded randomness,
  so every replay plays exactly the same.
- The solar system is real 3D: an orbit camera projects everything, and each
  planet is ray-cast per character cell, so it is lit by the Sun from the
  correct side, spins, and hides whatever is behind it. Saturn's ring is a
  ray-plane intersection.
- `js/audio.js` generates the drone, riser, bang, ambient pad and the typing clicks with WebAudio.
- `js/data.js` holds the facts shown for each body.
