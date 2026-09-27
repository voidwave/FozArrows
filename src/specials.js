import { mulberry32 } from './rng.js';

/**
 * Gives some arrows special powers, deterministically per level:
 * gold (x3 points), bomb (clears neighbours) and
 * lock/key pairs (a locked arrow can't leave until its key arrow has).
 *
 * Locks keep every level solvable: the generator places arrows in reverse
 * removal order, so an arrow with a higher id can always be removed first.
 * Each key is picked with a higher id than its lock.
 */
export function assignKinds(arrows, L, seed) {
  const rng = mulberry32(seed ^ 0x5bd1e995);
  const pGold = L >= 3 ? 0.07 : 0;
  const pBomb = L >= 8 ? 0.05 : 0;
  const maxBombs = Math.max(1, Math.floor(arrows.length / 14));
  let bombs = 0;
  for (const a of arrows) {
    const r = rng();
    if (r < pBomb && bombs < maxBombs) {
      a.kind = 'bomb';
      bombs++;
    } else if (r < pBomb + pGold) a.kind = 'gold';
    else a.kind = 'normal';
  }
  // Make sure the level that introduces a special arrow actually has one.
  const intro = { 3: 'gold', 8: 'bomb' }[L];
  if (intro && !arrows.some((a) => a.kind === intro)) arrows[Math.floor(rng() * arrows.length)].kind = intro;

  if (L >= 11 && arrows.length >= 10) {
    const pairs = Math.min(3, 1 + Math.floor((L - 11) / 12));
    for (let p = 0; p < pairs; p++) {
      const plain = arrows.filter((a) => a.kind === 'normal');
      if (plain.length < 2) break;
      const lock = plain[Math.floor(rng() * (plain.length - 1))];
      const later = plain.filter((a) => a.id > lock.id);
      if (!later.length) continue;
      const k = later[Math.floor(rng() * later.length)];
      lock.kind = 'lock';
      k.kind = 'key';
      lock.pair = k.pair = p;
      lock.keyId = k.id;
      k.lockId = lock.id;
    }
  }
}
