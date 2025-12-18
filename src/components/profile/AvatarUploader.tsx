'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

type Props = {
  value?: string
  onChange: (url: string) => void
  label?: string
}

type Msg = { type: 'success' | 'error'; text: string } | null

export default function AvatarUploader({ value, onChange, label = 'Photo de profil' }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)

  const previewSrc = useMemo(() => localPreview ?? value ?? '', [localPreview, value])

  // ✅ évite les fuites mémoire (un blob par sélection)
  useEffect(() => {
    return () => {
      if (localPreview?.startsWith('blob:')) URL.revokeObjectURL(localPreview)
    }
  }, [localPreview])

  async function onPickFile(file: File) {
    setMsg(null)

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setMsg({ type: 'error', text: 'Format non supporté (jpg/png/webp).' })
      return
    }
    if (file.size > 3 * 1024 * 1024) {
      setMsg({ type: 'error', text: 'Fichier trop lourd (max 3MB).' })
      return
    }

    // ✅ revoke l'ancien preview si on re-choisit un fichier
    if (localPreview?.startsWith('blob:')) URL.revokeObjectURL(localPreview)
    const objectUrl = URL.createObjectURL(file)
    setLocalPreview(objectUrl)

    const fd = new FormData()
    fd.set('file', file)

    setUploading(true)
    try {
      const res = await fetch('/api/uploads/avatar', {
        method: 'POST',
        body: fd,
        cache: 'no-store',
        credentials: 'include',
      })

      // on essaye de lire une erreur json si dispo, sinon text
      let data: any = null
      try {
        data = await res.json()
      } catch {
        data = null
      }

      if (!res.ok) {
        const msgTxt = data?.error || data?.message
        throw new Error(msgTxt || `Upload failed (${res.status})`)
      }

      // ✅ accepte {url} ou {ok:true,url}
      const url = data?.url
      if (typeof url !== 'string' || !url) throw new Error('No url returned')

      onChange(url)
      setMsg({ type: 'success', text: 'Photo uploadée ✅ (pense à sauvegarder le profil).' })
    } catch (e: any) {
      console.error(e)
      setMsg({ type: 'error', text: "Upload impossible. Vérifie le token Blob en local." })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-white/70">{label}</div>

      <div className="flex items-center gap-4">
        <div className="h-16 w-16 overflow-hidden rounded-full border border-white/15 bg-white/5">
          {previewSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewSrc} alt="Avatar" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-white/45">
              Avatar
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10 disabled:opacity-50"
          >
            {uploading ? 'Upload…' : 'Uploader une photo'}
          </button>

          {value || localPreview ? (
            <button
              type="button"
              onClick={() => {
                if (localPreview?.startsWith('blob:')) URL.revokeObjectURL(localPreview)
                setLocalPreview(null)
                onChange('')
                setMsg({ type: 'success', text: 'Avatar retiré (pense à sauvegarder).' })
              }}
              disabled={uploading}
              className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10 disabled:opacity-50"
            >
              Retirer
            </button>
          ) : null}

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onPickFile(f)
              e.currentTarget.value = ''
            }}
          />
        </div>
      </div>

      {msg ? (
        <div
          className={[
            'rounded-2xl border px-3 py-2 text-xs',
            msg.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
              : 'border-red-500/30 bg-red-500/10 text-red-100',
          ].join(' ')}
        >
          {msg.text}
        </div>
      ) : null}
    </div>
  )
}
