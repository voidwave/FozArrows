// Level sizes grow from a tiny 4×6 board to a dense 22×35 maze.
export function levelConfig(L) {
  const W = Math.min(22, Math.round(3.5 + 0.9 * Math.sqrt(L)));
  const H = Math.min(35, Math.round(W * 1.6));
  return {
    W, H,
    seed: L * 7919 + 1013,
    minLen: L < 6 ? 2 : 3,
    maxLen: Math.min(4 + Math.floor(L / 15), 12),
    turnP: 0.35 + Math.min(0.2, L * 0.002),
    spread: 0.2,
  };
}

// The leaderboard's per-level maximum. Must match maxScore_() in leaderboard/Code.gs,
// which was written for the cube version (levelN_ there is the old cube size).
const cubeN = (L) => (L === 1 ? 2 : L <= 4 ? 3 : L <= 9 ? 4 : L <= 16 ? 5 : L <= 26 ? 6 : L <= 40 ? 7 : 8);
export const levelMax = (L) => 3 * cubeN(L) ** 2 * 50 + 150 + 5 * L;
