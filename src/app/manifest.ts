import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'VM-Tips 2026',
    short_name: 'VM-Tips',
    description: 'Tipstävling för FIFA World Cup 2026',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0b1320',
    theme_color: '#10b981',
    icons: [
      {
        src: '/vm2026-logo.avif',
        sizes: 'any',
        type: 'image/avif',
        purpose: 'any',
      },
    ],
  }
}
