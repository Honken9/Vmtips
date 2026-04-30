'use client'

export function TrophyLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 32, md: 48, lg: 72 }
  const px = sizes[size]

  return (
    <div className="flex items-center gap-3">
      <svg
        width={px}
        height={px}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Troféskaft */}
        <rect x="20" y="36" width="8" height="5" rx="1" fill="#d97706" />
        {/* Bas */}
        <rect x="14" y="41" width="20" height="4" rx="2" fill="#f59e0b" />
        {/* Trofékropp */}
        <path
          d="M12 6h24v2c0 10-4 17-12 20C16 25 12 18 12 8V6z"
          fill="url(#trophy-body)"
        />
        {/* Handtag */}
        <path d="M12 9 C6 9 6 18 12 18" stroke="#f59e0b" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M36 9 C42 9 42 18 36 18" stroke="#f59e0b" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {/* Stjärna */}
        <path
          d="M24 11l1.5 4.5h4.8l-3.9 2.8 1.5 4.5L24 20l-3.9 2.8 1.5-4.5-3.9-2.8h4.8z"
          fill="#fcd34d"
        />
        <defs>
          <linearGradient id="trophy-body" x1="12" y1="6" x2="36" y2="28" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fcd34d" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>
        </defs>
      </svg>

      <div>
        <div
          className={`font-black tracking-tight leading-none ${
            size === 'lg' ? 'text-3xl' : size === 'md' ? 'text-xl' : 'text-base'
          }`}
          style={{ color: '#f59e0b' }}
        >
          VM-TIPS
        </div>
        <div
          className={`text-gray-400 font-medium tracking-widest uppercase ${
            size === 'lg' ? 'text-sm' : 'text-xs'
          }`}
        >
          FIFA World Cup 2026
        </div>
      </div>
    </div>
  )
}
