# Foz Arrows

A 3D arrow puzzle for mobile: spin the cube and tap arrows to slide them off.
An arrow can only leave when nothing blocks it between its head and the edge
of its face. Tapping a blocked arrow costs a heart. Clear the cube to win.

Play: https://voidwave.com/FozArrows/

- Endless levels. The cubes get bigger (2×2 up to 8×8 per face) and the arrows get longer.
- Every level can be solved. The generator places arrows in reverse removal order.
- Combos, stars, hints, sound, haptics, dark mode, and saved progress.

## Develop

```sh
npm install
npm run dev     # rebuilds on change and serves http://localhost:8000
npm test        # checks the generator on 300 levels: all solvable, no overlaps
npm run build   # writes dist/game.js (committed so GitHub Pages can serve it)
```

The site is fully static: `index.html` + `dist/game.js`. There is no build step on Pages.
