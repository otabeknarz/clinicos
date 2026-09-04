/**
 * Aniqlangan (deterministik) tasodifiy sonlar.
 *
 * Bir xil urug'dan (seed) doim bir xil ma'lumot chiqadi — shuning uchun
 * sahifani yangilaganda demo ma'lumot o'zgarib ketmaydi va skrinshotlar
 * bir xil bo'ladi.
 */

export function createRandom(seed: number) {
  let state = seed >>> 0

  /** 0 ≤ x < 1 */
  function next(): number {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  return {
    next,
    /** min ≤ x ≤ max, butun son */
    int(min: number, max: number): number {
      return Math.floor(next() * (max - min + 1)) + min
    },
    /** Ro'yxatdan bitta element */
    pick<T>(items: readonly T[]): T {
      return items[Math.floor(next() * items.length)]
    },
    /** Ro'yxatdan n ta takrorlanmas element */
    sample<T>(items: readonly T[], n: number): T[] {
      const copy = [...items]
      const out: T[] = []
      for (let i = 0; i < n && copy.length > 0; i++) {
        out.push(copy.splice(Math.floor(next() * copy.length), 1)[0])
      }
      return out
    },
    /** `p` ehtimollik bilan true (0…1) */
    chance(p: number): boolean {
      return next() < p
    },
    /** Og'irlikka qarab tanlash: [['a', 3], ['b', 1]] → 'a' 3 baravar ko'p */
    weighted<T>(pairs: readonly (readonly [T, number])[]): T {
      const total = pairs.reduce((sum, [, w]) => sum + w, 0)
      let r = next() * total
      for (const [value, weight] of pairs) {
        r -= weight
        if (r <= 0) return value
      }
      return pairs[pairs.length - 1][0]
    },
    /** Ro'yxatni aralashtirish */
    shuffle<T>(items: readonly T[]): T[] {
      const copy = [...items]
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        ;[copy[i], copy[j]] = [copy[j], copy[i]]
      }
      return copy
    },
  }
}

export type Random = ReturnType<typeof createRandom>
