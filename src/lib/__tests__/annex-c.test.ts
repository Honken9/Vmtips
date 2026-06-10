import { describe, it, expect } from 'vitest'
import annexC from '../annex-c.json'

const ALL_GROUPS = 'ABCDEFGHIJKL'.split('')
const SLOTS = ['1A', '1B', '1D', '1E', '1G', '1I', '1K', '1L'] as const

function combinations<T>(arr: T[], k: number): T[][] {
  const out: T[][] = []
  function rec(i: number, picked: T[]) {
    if (picked.length === k) { out.push(picked.slice()); return }
    for (let j = i; j < arr.length; j++) {
      picked.push(arr[j])
      rec(j + 1, picked)
      picked.pop()
    }
  }
  rec(0, [])
  return out
}

describe('Annex C – FIFA 2026 third-place allocation table', () => {
  const combos = annexC.combinations as Record<string, Record<string, string>>
  const allowed = annexC._meta.allowed_thirds_per_slot as Record<string, string[]>

  it('contains exactly 495 unique keys = all 8-subsets of A–L', () => {
    const expected = combinations(ALL_GROUPS, 8).map(c => c.join(''))
    const actual = Object.keys(combos)
    expect(actual.length).toBe(495)
    expect(new Set(actual).size).toBe(495)
    expect(new Set(actual)).toEqual(new Set(expected))
  })

  it('every key is sorted A→L and made of 8 distinct group letters from A–L', () => {
    for (const key of Object.keys(combos)) {
      expect(key.length).toBe(8)
      expect(key.split('').sort().join('')).toBe(key)
      for (const ch of key) expect(ALL_GROUPS).toContain(ch)
    }
  })

  it('every row assigns 8 groups that are a permutation of the key', () => {
    for (const [key, slots] of Object.entries(combos)) {
      const assigned = SLOTS.map(s => slots[s]).sort().join('')
      expect(assigned).toBe(key)
    }
  })

  it('every assignment respects its slot allowed-groups set', () => {
    for (const [key, slots] of Object.entries(combos)) {
      for (const slot of SLOTS) {
        const g = slots[slot]
        expect(allowed[slot]).toContain(g)
        // Defense: the assigned group must be one of the qualified 8
        expect(key).toContain(g)
      }
    }
  })

  it('passes the canonical acceptance test: thirds from {A,B,D,E,F,G,I,L}', () => {
    expect(combos['ABDEFGIL']).toEqual({
      '1A': 'E', '1B': 'G', '1D': 'B', '1E': 'D',
      '1G': 'A', '1I': 'F', '1K': 'L', '1L': 'I',
    })
  })

  it('slot → match number mapping matches FIFA schedule', () => {
    expect(annexC._meta.slot_to_match).toEqual({
      '1A': 79, '1B': 85, '1D': 81, '1E': 74,
      '1G': 82, '1I': 77, '1K': 87, '1L': 80,
    })
  })
})
