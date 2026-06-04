// Delade taggfärger för pool_member_tags. Använd den här i alla vyer
// (LigaClient, LeaderboardTable, AdminUsersTable, CategorySummary…).

export interface TagColor {
  key: string
  hex: string
  label: string
}

export const TAG_COLORS: TagColor[] = [
  { key: 'emerald', hex: '#10b981', label: 'Grön' },
  { key: 'sky',     hex: '#0ea5e9', label: 'Blå' },
  { key: 'rose',    hex: '#f43f5e', label: 'Rosa' },
  { key: 'amber',   hex: '#f59e0b', label: 'Gul' },
  { key: 'violet',  hex: '#8b5cf6', label: 'Lila' },
  { key: 'cyan',    hex: '#06b6d4', label: 'Cyan' },
  { key: 'lime',    hex: '#84cc16', label: 'Lime' },
  { key: 'pink',    hex: '#ec4899', label: 'Skär' },
  { key: 'orange',  hex: '#f97316', label: 'Orange' },
  { key: 'slate',   hex: '#94a3b8', label: 'Grå' },
]

export const TAG_COLOR_HEX: Record<string, string> = Object.fromEntries(
  TAG_COLORS.map(c => [c.key, c.hex])
)

export function colorHex(key: string | null | undefined): string | null {
  if (!key) return null
  return TAG_COLOR_HEX[key] ?? null
}
