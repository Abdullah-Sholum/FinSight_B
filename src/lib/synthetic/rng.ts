// Pembangkit acak ber-seed (mulberry32): seed sama menghasilkan deret yang sama.
export type Rng = {
  next(): number; // [0, 1)
  int(min: number, max: number): number; // inklusif
  uniform(min: number, max: number): number;
  normal(): number; // N(0, 1)
  weighted(weights: number[]): number; // indeks terpilih
  shuffle<T>(items: T[]): T[];
};

// Memecah satu seed menjadi aliran terpisah ("profile", "generate") tanpa saling memengaruhi.
export function deriveSeed(seed: number, label: string): number {
  let h = 0x811c9dc5; // FNV-1a 32-bit
  const s = `${seed}:${label}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    uniform: (min, max) => min + next() * (max - min),
    normal: () => {
      const u = 1 - next(); // (0, 1]
      const v = next();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    weighted: (weights) => {
      const total = weights.reduce((x, y) => x + y, 0);
      let r = next() * total;
      for (let i = 0; i < weights.length; i++) {
        r -= weights[i];
        if (r < 0) return i;
      }
      return weights.length - 1;
    },
    shuffle: (items) => {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
  };
}