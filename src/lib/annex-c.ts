// FIFA World Cup 2026 – Annex C lookup wrapper.
//
// All 495 C(12,8) combinations are stored verbatim in annex-c.json. We NEVER
// derive the assignment from logic – we only look it up.

import annexCData from './annex-c.json'

export type GroupLetter = 'A'|'B'|'C'|'D'|'E'|'F'|'G'|'H'|'I'|'J'|'K'|'L'
export type WinnerSlot = '1A'|'1B'|'1D'|'1E'|'1G'|'1I'|'1K'|'1L'

export const THIRD_SLOT_TO_MATCH: Record<WinnerSlot, number> = {
  '1A': 79, '1B': 85, '1D': 81, '1E': 74,
  '1G': 82, '1I': 77, '1K': 87, '1L': 80,
}

const COMBINATIONS = annexCData.combinations as Record<string, Record<WinnerSlot, GroupLetter>>

/**
 * Returns the third-place team allocation for the 8 qualified groups.
 *
 * Input: any 8 group letters whose third-placed teams qualified.
 * Output: a map from winner slot (e.g. "1A") to the group letter whose
 * third-placed team plays that group winner in the round of 32.
 *
 * Throws if `qualifiedGroups` is not exactly 8 distinct letters from A–L,
 * or if (impossibly) Annex C has no row for the combination.
 */
export function thirdAssignments(
  qualifiedGroups: GroupLetter[]
): Record<WinnerSlot, GroupLetter> {
  if (qualifiedGroups.length !== 8) {
    throw new Error(`Need exactly 8 qualified third-placed groups, got ${qualifiedGroups.length}`)
  }
  const sorted = [...qualifiedGroups].sort().join('')
  if (new Set(sorted).size !== 8) {
    throw new Error(`Qualified groups must be 8 distinct letters, got "${sorted}"`)
  }
  const row = COMBINATIONS[sorted]
  if (!row) {
    throw new Error(`Annex C has no row for combination "${sorted}" – data is corrupt`)
  }
  return row
}
