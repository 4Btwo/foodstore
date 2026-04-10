/**
 * Cloudinary upload — browser direto, sem backend.
 * Usa "unsigned upload preset" que você configura no painel do Cloudinary.
 *
 * Como configurar:
 * 1. Acesse: https://console.cloudinary.com → Settings → Upload → Upload presets
 * 2. Clique "Add upload preset"
 * 3. Signing mode: "Unsigned"
 * 4. Folder: "foodstore" (opcional)
 * 5. Copie o nome do preset para VITE_CLOUDINARY_UPLOAD_PRESET
 * 6. Copie seu Cloud Name para VITE_CLOUDINARY_CLOUD_NAME
 */

export type UploadProgress = (pct: number) => void

export interface CloudinaryResult {
  url:       string   // URL otimizada (https)
  publicId:  string   // para deletar depois se quiser
  width:     number
  height:    number
}

const CLOUD_NAME    = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME   as string
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string

export function cloudinaryConfigured(): boolean {
  return Boolean(CLOUD_NAME && UPLOAD_PRESET)
}

export function validateImageFile(file: File): string | null {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowed.includes(file.type)) return 'Formato inválido. Use JPG, PNG, WebP ou GIF.'
  if (file.size > 10 * 1024 * 1024)  return 'Arquivo muito grande. Máximo 10MB.'
  return null
}

export async function uploadToCloudinary(
  file:       File,
  folder?:    string,
  onProgress?: UploadProgress,
): Promise<CloudinaryResult> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error(
      'Cloudinary não configurado. Adicione VITE_CLOUDINARY_CLOUD_NAME e VITE_CLOUDINARY_UPLOAD_PRESET no .env',
    )
  }

  const formData = new FormData()
  formData.append('file',         file)
  formData.append('upload_preset', UPLOAD_PRESET)
  if (folder) formData.append('folder', folder)

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText)
        resolve({
          url:      data.secure_url,
          publicId: data.public_id,
          width:    data.width,
          height:   data.height,
        })
      } else {
        try {
          const err = JSON.parse(xhr.responseText)
          reject(new Error(err?.error?.message ?? `Erro ${xhr.status}`))
        } catch {
          reject(new Error(`Erro no upload: ${xhr.status}`))
        }
      }
    })

    xhr.addEventListener('error',  () => reject(new Error('Falha na conexão com Cloudinary')))
    xhr.addEventListener('abort',  () => reject(new Error('Upload cancelado')))

    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`)
    xhr.send(formData)
  })
}
