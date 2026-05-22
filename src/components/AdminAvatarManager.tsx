'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { TEAM_OPTIONS, POSE_OPTIONS, ARENA_OPTIONS } from '@/lib/avatar-options'
import { Loader2, Sparkles, Camera, Trash2, CheckCircle, AlertCircle } from 'lucide-react'

interface Props {
  userId: string
  displayName: string
  currentAvatar: string | null
  onChanged: (newUrl: string | null) => void
}

/** Komprimerar bilden lätt (JPEG 0.9) för snabbare uppladdning. */
async function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas saknas')); return }
      ctx.drawImage(img, 0, 0)
      canvas.toBlob(
        blob => {
          if (!blob) { reject(new Error('Komprimering misslyckades')); return }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }))
        },
        'image/jpeg',
        0.9
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Kunde inte läsa bilden')) }
    img.src = url
  })
}

export function AdminAvatarManager({ userId, displayName, currentAvatar, onChanged }: Props) {
  const supabase = createClient()
  const [preview, setPreview] = useState<string | null>(null)
  const [team, setTeam] = useState(TEAM_OPTIONS[0].value)
  const [pose, setPose] = useState(POSE_OPTIONS[0].value)
  const [arena, setArena] = useState(ARENA_OPTIONS[0].value)
  const [busy, setBusy] = useState<'generate' | 'remove' | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)

  function pickFile(f: File) {
    if (!f.type.startsWith('image/')) {
      setMsg({ ok: false, text: 'Välj en bildfil' })
      return
    }
    setMsg(null)
    setFile(f)
    const reader = new FileReader()
    reader.onload = e => setPreview(e.target?.result as string)
    reader.readAsDataURL(f)
  }

  async function generate() {
    if (!file) return
    setBusy('generate')
    setMsg(null)
    let uploadFile = file
    try {
      uploadFile = await compressImage(file)
    } catch {
      // fall tillbaka på originalet
    }
    const form = new FormData()
    form.append('image', uploadFile)
    form.append('team', team)
    form.append('pose', pose)
    form.append('arena', arena)
    form.append('targetUserId', userId)

    try {
      const res = await fetch('/api/generate-football-image', { method: 'POST', body: form })
      const data = await res.json().catch(() => ({}))
      setBusy(null)
      if (!res.ok) {
        setMsg({ ok: false, text: data.error ?? `Fel (${res.status})` })
        return
      }
      setMsg({ ok: true, text: 'Ny bild genererad' })
      setPreview(null)
      setFile(null)
      onChanged(data.avatarUrl ?? null)
    } catch {
      setBusy(null)
      setMsg({ ok: false, text: 'Nätverksfel – försök igen' })
    }
  }

  async function removeAvatar() {
    if (!confirm(`Ta bort ${displayName}s profilbild?`)) return
    setBusy('remove')
    setMsg(null)
    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: null, avatar_locked: false })
      .eq('id', userId)
    setBusy(null)
    if (error) {
      setMsg({ ok: false, text: error.message })
      return
    }
    setMsg({ ok: true, text: 'Bild borttagen' })
    onChanged(null)
  }

  const selCls = 'px-2 py-1.5 rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-400/50 w-full'
  const selStyle = { background: '#1f2937', border: '1px solid #374151' }

  return (
    <div className="rounded-lg p-3 space-y-3" style={{ background: '#0f172a', border: '1px solid #1f2937' }}>
      <div className="flex items-start gap-3">
        {/* Nuvarande bild */}
        <div className="relative w-16 h-20 rounded-lg overflow-hidden shrink-0"
          style={{ background: '#1f2937', border: '1px solid #374151' }}>
          {(preview || currentAvatar) ? (
            <Image src={preview || currentAvatar || ''} alt={displayName} fill className="object-cover" sizes="64px" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-600 text-[10px]">
              Ingen bild
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(f) }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded text-gray-200"
            style={{ background: '#1f2937', border: '1px solid #374151' }}
          >
            <Camera size={12} />
            {file ? 'Byt foto' : 'Ladda upp foto'}
          </button>
          {currentAvatar && (
            <button
              onClick={removeAvatar}
              disabled={busy === 'remove'}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded text-red-300 disabled:opacity-40"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}
            >
              {busy === 'remove' ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              Ta bort bild
            </button>
          )}
        </div>
      </div>

      {/* Val + generera – visas när foto valts */}
      {file && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <select value={team} onChange={e => setTeam(e.target.value)} className={selCls} style={selStyle}>
              {TEAM_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select value={pose} onChange={e => setPose(e.target.value)} className={selCls} style={selStyle}>
              {POSE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select value={arena} onChange={e => setArena(e.target.value)} className={selCls} style={selStyle}>
              {ARENA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <button
            onClick={generate}
            disabled={busy === 'generate'}
            className="flex items-center justify-center gap-2 w-full py-2 rounded-lg text-sm font-semibold text-black disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #10b981, #ef4444)' }}
          >
            {busy === 'generate' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {busy === 'generate' ? 'Genererar… (kan ta ~30s)' : `Generera ny bild för ${displayName}`}
          </button>
        </>
      )}

      {msg && (
        <div className={`flex items-center gap-1.5 text-xs ${msg.ok ? 'text-green-400' : 'text-red-400'}`}>
          {msg.ok ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
          {msg.text}
        </div>
      )}
    </div>
  )
}
