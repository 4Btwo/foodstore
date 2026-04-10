/**
 * ImageUploader — upload para Cloudinary com drag & drop, progresso e preview.
 * Se o Cloudinary não estiver configurado, cai para input de URL manual.
 */
import { useRef, useState, useCallback } from 'react'
import {
  uploadToCloudinary, validateImageFile,
  cloudinaryConfigured, type UploadProgress,
} from '@/services/cloudinary'

interface Props {
  label:        string
  value:        string            // URL atual
  folder?:      string            // pasta no Cloudinary, ex: "foodstore/logos"
  aspectClass?: string            // ex: "aspect-square" | "aspect-video"
  hint?:        string
  onChange:     (url: string) => void
}

export function ImageUploader({
  label, value, folder, aspectClass = 'aspect-video', hint, onChange,
}: Props) {
  const inputRef              = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError]     = useState('')
  const [dragging, setDragging] = useState(false)
  const configured            = cloudinaryConfigured()

  const handleFile = useCallback(async (file: File) => {
    setError('')
    const err = validateImageFile(file)
    if (err) { setError(err); return }

    setProgress(0)
    try {
      const result = await uploadToCloudinary(file, folder, (pct) => setProgress(pct))
      onChange(result.url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro no upload')
    } finally {
      setProgress(null)
    }
  }, [folder, onChange])

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
        {label}
      </label>

      {/* Zona de upload / preview */}
      <div
        onClick={() => configured && inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); if (configured) setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`relative overflow-hidden rounded-2xl border-2 transition ${aspectClass} ${
          configured ? 'cursor-pointer' : 'cursor-default'
        } ${
          dragging
            ? 'border-brand-400 bg-brand-50/40'
            : value
              ? 'border-gray-200'
              : 'border-dashed border-gray-200 bg-gray-50 hover:border-brand-300 hover:bg-brand-50/20'
        }`}
      >
        {value ? (
          <>
            <img
              src={value} alt=""
              className="h-full w-full object-cover"
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
            />
            {/* Overlay hover */}
            {configured && progress === null && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition">
                <span className="rounded-xl bg-white/90 px-3 py-1.5 text-xs font-bold text-gray-800 shadow">
                  Trocar imagem
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
            {configured ? (
              <>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-200 text-xl">
                  {dragging ? '📥' : '🖼️'}
                </div>
                <p className="text-xs font-medium text-gray-500">
                  {dragging ? 'Solte para enviar' : 'Clique ou arraste uma imagem'}
                </p>
                <p className="text-xs text-gray-400">JPG, PNG, WebP · Máx. 10MB</p>
              </>
            ) : (
              <>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-200 text-xl">🖼️</div>
                <p className="text-xs text-gray-400">Cole a URL da imagem abaixo</p>
              </>
            )}
          </div>
        )}

        {/* Barra de progresso */}
        {progress !== null && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50">
            <div className="w-3/5 overflow-hidden rounded-full bg-white/30 h-2">
              <div
                className="h-2 rounded-full bg-white transition-all duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm font-bold text-white">{progress}%</p>
          </div>
        )}
      </div>

      {/* Botões abaixo do preview */}
      <div className="mt-2 flex gap-2">
        {configured && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={progress !== null}
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
          >
            📁 Selecionar arquivo
          </button>
        )}
        <input
          type="url"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={configured ? 'Ou cole uma URL…' : 'https://res.cloudinary.com/…'}
          className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-700 outline-none transition focus:border-brand-400"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-400 hover:bg-gray-50 transition"
          >
            ✕
          </button>
        )}
      </div>

      {/* Hint e erro */}
      {hint && <p className="mt-1.5 text-xs text-gray-400">{hint}</p>}
      {error && <p className="mt-1.5 text-xs font-medium text-red-500">{error}</p>}

      {/* Aviso se não configurado */}
      {!configured && (
        <p className="mt-1.5 text-xs text-amber-600">
          ⚠️ Adicione <code className="font-mono bg-amber-50 px-1 rounded">VITE_CLOUDINARY_CLOUD_NAME</code> e{' '}
          <code className="font-mono bg-amber-50 px-1 rounded">VITE_CLOUDINARY_UPLOAD_PRESET</code> no <code className="font-mono bg-amber-50 px-1 rounded">.env</code> para ativar o upload.
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={onFileInput}
      />
    </div>
  )
}
