# Foz Arrows

An arrow-maze puzzle for phones and tablets. Every arrow slides forward along
its own path when you tap it, and leaves the board if nothing is in its way all
the way to the edge. Tapping a blocked arrow costs a 💧; lose all three and the
level restarts. Free every arrow to win.

Play: https://voidwave.com/FozArrows/

- **Hundreds of levels.** Boards grow from a tiny 4×6 grid to dense 22×35 mazes
  with over 100 winding arrows. Levels are generated from their number, so
  level 250 is the same for everyone, and every level is guaranteed solvable.
- **Level select** behind the ← button, 100 levels per page, with your stars.
- **Pinch to zoom** and drag around big boards.
- **💡 Hints** number your next moves: tap the 1s first, then the 2s.
- 📅 **Daily Challenge** with a streak counter and a share button.
- 🏆 **Global leaderboard** on Google Sheets. See [leaderboard/README.md](leaderboard/README.md).
- 🏅 Ten achievements, 🎨 seven arrow colours unlocked with stars, combos, dark mode.
- **English and Arabic (عربي)**, with a right-to-left layout and Arabic numerals.

## Develop

```sh
npm install
npm run dev     # rebuilds on change and serves http://localhost:8000
npm test        # generates 155 levels and checks each one is solvable and well formed
npm run build   # writes dist/game.js (committed so GitHub Pages can serve it)
```

The site is fully static: `index.html` + `dist/game.js`. There is no build step on Pages.

- `src/grid.js` – board model and the level generator. Arrows are placed in
  reverse removal order, from the centre outwards, so every level is solvable
  and the board packs tightly.
- `src/levels.js` – level size and difficulty curve.
- `src/main.js` – rendering (canvas), input, screens and saving.
