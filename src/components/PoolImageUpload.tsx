'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Camera, Loader2, Trash2, CheckCircle, AlertCircle } from 'lucide-react'

interface Props {
  poolId: number
  poolName: string
  currentUrl: string | null
  /** Hur bilden ska visas i preview-thumbnailen */
  aspect?: 'square' | 'banner'
}

export function PoolImageUpload({ poolId, poolName, currentUrl, aspect = 'square' }: Props) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState(currentUrl)
  const [busy, setBusy] = useState<'upload' | 'remove' | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  function flash(ok: boolean, text: string) {
    setMsg({ ok, text })
    setTimeout(() => setMsg(null), 4000)
  }

  async function upload(file: File) {
    setBusy('upload')
    setMsg(null)
    const form = new FormData()
    form.append('image', file)
    const res = await fetch(`/api/pool-image/${poolId}`, { method: 'POST', body: form })
    setBusy(null)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      flash(false, data.error ?? `HTTP ${res.status}`)
      return
    }
    setUrl(data.url)
    flash(true, 'Bild uppdaterad')
    router.refresh()
  }

  async function remove() {
    if (!confirm(`Ta bort liga-bilden för "${poolName}"?`)) return
    setBusy('remove')
    setMsg(null)
    const res = await fetch(`/api/pool-image/${poolId}`, { method: 'DELETE' })
    setBusy(null)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      flash(false, data.error ?? `HTTP ${res.status}`)
      return
    }
    setUrl(null)
    flash(true, 'Bild borttagen')
    router.refresh()
  }

  const previewSize = aspect === 'banner' ? 'w-32 h-16' : 'w-20 h-20'

  return (
    <div className="flex items-start gap-3">
      <div
        className={`relative ${previewSize} rounded-lg overflow-hidden shrink-0`}
        style={{ background: '#1f2937', border: '1px solid #374151' }}
      >
        {url ? (
          <Image src={url} alt={poolName} fill className="object-cover" sizes={aspect === 'banner' ? '128px' : '80px'} unoptimized />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600 text-[10px] text-center px-1">
            Ingen bild
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 space-y-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) upload(f)
            e.target.value = ''
          }}
        />
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy === 'upload'}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded text-gray-200 disabled:opacity-40"
            style={{ background: '#1f2937', border: '1px solid #374151' }}
          >
            {busy === 'upload' ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
            {url ? 'Byt bild' : 'Ladda upp bild'}
          </button>
          {url && (
            <button
              onClick={remove}
              disabled={busy === 'remove'}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded text-red-300 disabled:opacity-40"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}
            >
              {busy === 'remove' ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              Ta bort
            </button>
          )}
        </div>
        <p className="text-[10px] text-gray-500">PNG / JPG / WEBP / GIF, max 5 MB.</p>
        {msg && (
          <div className={`flex items-center gap-1.5 text-xs ${msg.ok ? 'text-green-400' : 'text-red-400'}`}>
            {msg.ok ? <CheckCircle size={11} /> : <AlertCircle size={11} />}
            {msg.text}
          </div>
        )}
      </div>
    </div>
  )
}
