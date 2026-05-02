'use client'

import { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import {
  Database, Download, Loader2, RefreshCw, RotateCcw, AlertTriangle,
} from 'lucide-react'

interface Snapshot {
  key: string
  created_at: string
  size: number
  downloadUrl: string | null
}

export default function AdminBackupsPage() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [restoreModal, setRestoreModal] = useState<{ key: string; confirm: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/backup/list')
      const data = await res.json()
      if (res.ok) setSnapshots(data.snapshots ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function createBackup() {
    setCreating(true)
    setMessage(null)
    try {
      const r1 = await fetch('/api/backup?reason=manual&force=true', { method: 'POST' })
      const j1 = await r1.json()

      // Ladda även ner direkt så användaren har en off-Supabase-kopia
      const r2 = await fetch('/api/backup')
      if (r2.ok) {
        const blob = await r2.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        const ts = new Date().toISOString().replace(/[:.]/g, '-')
        a.download = `vmtips-backup-${ts}.json`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
      }
      setMessage({
        type: 'ok',
        text: j1.skipped ? j1.message : 'Backup skapad i Storage + nedladdad lokalt',
      })
      await load()
    } catch (err) {
      setMessage({ type: 'err', text: String(err) })
    } finally {
      setCreating(false)
      setTimeout(() => setMessage(null), 8000)
    }
  }

  async function doRestore() {
    if (!restoreModal) return
    if (restoreModal.confirm !== 'ÅTERSTÄLL') {
      setMessage({ type: 'err', text: 'Skriv ÅTERSTÄLL exakt' })
      return
    }
    const keyToRestore = restoreModal.key
    setRestoring(keyToRestore)
    setRestoreModal(null)
    try {
      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: keyToRestore, confirm: 'ÅTERSTÄLL' }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setMessage({ type: 'ok', text: 'Återställning klar (en pre-restore-backup togs först)' })
      } else {
        setMessage({
          type: 'err',
          text: data.error || data.message || 'Restore misslyckades',
        })
      }
    } catch (err) {
      setMessage({ type: 'err', text: String(err) })
    } finally {
      setRestoring(null)
      await load()
      setTimeout(() => setMessage(null), 10000)
    }
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Database size={22} className="text-emerald-400" />
            Backups
          </h1>
          <p className="text-gray-400 text-sm mt-1 max-w-2xl">
            Snapshots av alla tips, resultat, bonus och inställningar. Auto-backup vid
            spar-händelser (rate-limit 10 min). Senaste 50 sparas, äldre raderas automatiskt.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-gray-400 hover:text-white disabled:opacity-50"
            style={{ background: '#1f2937', border: '1px solid #374151' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Uppdatera
          </button>
          <button
            onClick={createBackup}
            disabled={creating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
            style={{
              background: 'rgba(16,185,129,0.15)',
              color: '#10b981',
              border: '1px solid rgba(16,185,129,0.3)',
            }}
          >
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Skapa backup nu
          </button>
        </div>
      </div>

      {message && (
        <div
          className="px-4 py-3 rounded-lg text-sm"
          style={{
            background: message.type === 'ok' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            color: message.type === 'ok' ? '#4ade80' : '#f87171',
            border: `1px solid ${message.type === 'ok' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
          }}
        >
          {message.text}
        </div>
      )}

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1f2937' }}>
        {loading ? (
          <div className="p-12 text-center text-gray-500">
            <Loader2 size={20} className="animate-spin inline mr-2" />
            Laddar…
          </div>
        ) : snapshots.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Database size={32} className="opacity-30 mx-auto mb-3" />
            <div>Inga snapshots än.</div>
            <div className="text-xs mt-1">Tryck &quot;Skapa backup nu&quot; för att börja.</div>
          </div>
        ) : (
          snapshots.map((s, i) => {
            const date = s.created_at ? new Date(s.created_at) : null
            const formatted = date
              ? format(date, 'EEE d MMM yyyy HH:mm:ss', { locale: sv })
              : '?'
            const fileName = s.key.split('/').pop() ?? s.key
            return (
              <div
                key={s.key}
                className={`flex items-center gap-3 px-4 sm:px-5 py-3 ${i > 0 ? 'border-t' : ''}`}
                style={{ borderColor: '#1f2937', background: '#111827' }}
              >
                <Database size={16} className="text-gray-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white">{formatted}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {fileName} · {formatSize(s.size)}
                  </div>
                </div>
                {s.downloadUrl && (
                  <a
                    href={s.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors text-gray-300 hover:text-white"
                    style={{ background: '#1f2937' }}
                  >
                    <Download size={12} />
                    <span className="hidden sm:inline">Ladda ner</span>
                  </a>
                )}
                <button
                  onClick={() => setRestoreModal({ key: s.key, confirm: '' })}
                  disabled={restoring === s.key}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors text-red-400 hover:text-red-300 disabled:opacity-40"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}
                >
                  {restoring === s.key ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <RotateCcw size={12} />
                  )}
                  <span className="hidden sm:inline">Återställ</span>
                </button>
              </div>
            )
          })
        )}
      </div>

      {restoreModal && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 z-50"
          style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={() => setRestoreModal(null)}
        >
          <div
            className="rounded-xl p-6 max-w-md w-full space-y-4"
            style={{ background: '#111827', border: '1px solid #374151' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <AlertTriangle size={24} className="text-red-400" />
              <h2 className="text-xl font-bold text-white">Återställ från backup?</h2>
            </div>
            <p className="text-sm text-gray-300">
              Detta skriver över <strong>alla nuvarande tips, resultat, bonus och inställningar</strong>{' '}
              med innehållet från snapshoten. En automatisk pre-restore-backup tas innan, så du kan
              ångra om något blir fel.
            </p>
            <p className="text-xs text-gray-500 break-all font-mono bg-black/30 px-3 py-2 rounded">
              {restoreModal.key}
            </p>
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Skriv{' '}
                <code className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-mono">
                  ÅTERSTÄLL
                </code>{' '}
                för att bekräfta:
              </label>
              <input
                type="text"
                value={restoreModal.confirm}
                onChange={e =>
                  setRestoreModal(m => (m ? { ...m, confirm: e.target.value } : null))
                }
                className="w-full px-3 py-2 rounded-lg text-white"
                style={{ background: '#1f2937', border: '1px solid #374151' }}
                autoFocus
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setRestoreModal(null)}
                className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white"
              >
                Avbryt
              </button>
              <button
                onClick={doRestore}
                disabled={restoreModal.confirm !== 'ÅTERSTÄLL'}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40"
                style={{ background: '#dc2626' }}
              >
                Återställ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
