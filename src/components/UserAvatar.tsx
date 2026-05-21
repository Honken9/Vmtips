import Image from 'next/image'

const SIZE_PX: Record<string, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 80,
}

const SIZE_CLASS: Record<string, string> = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-base',
  xl: 'w-20 h-20 text-xl',
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function UserAvatar({
  src,
  name,
  size = 'sm',
  className = '',
}: {
  src?: string | null
  name: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}) {
  const px = SIZE_PX[size]
  const cls = SIZE_CLASS[size]
  return (
    <div
      className={`relative shrink-0 rounded-full overflow-hidden ${cls} ${className}`}
      style={{ background: '#1f2937', border: '1px solid #374151' }}
    >
      {src ? (
        <Image src={src} alt={name} fill sizes={`${px}px`} className="object-cover" />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
        >
          {initialsOf(name)}
        </div>
      )}
    </div>
  )
}
