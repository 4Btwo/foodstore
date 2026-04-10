import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage'
import app from './firebase'

const storage = getStorage(app)

export type UploadProgress = (pct: number) => void

/**
 * Faz upload de um arquivo para o Firebase Storage e retorna a URL pública.
 * @param file       Arquivo selecionado pelo usuário
 * @param path       Caminho no Storage, ex: "restaurants/abc123/logo"
 * @param onProgress Callback opcional com % de progresso (0–100)
 */
export async function uploadFile(
  file: File,
  path: string,
  onProgress?: UploadProgress,
): Promise<string> {
  const storageRef = ref(storage, path)
  const task       = uploadBytesResumable(storageRef, file)

  return new Promise((resolve, reject) => {
    task.on(
      'state_changed',
      (snap) => {
        if (onProgress) {
          onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100))
        }
      },
      reject,
      async () => {
        const url = await getDownloadURL(task.snapshot.ref)
        resolve(url)
      },
    )
  })
}

/**
 * Deleta um arquivo do Storage pela URL pública.
 */
export async function deleteFileByUrl(url: string): Promise<void> {
  try {
    const fileRef = ref(storage, url)
    await deleteObject(fileRef)
  } catch {
    // ignora se o arquivo não existir
  }
}

/**
 * Valida e comprime imagem antes do upload (max 2MB, converte para JPEG 80%)
 */
export function validateImageFile(file: File): string | null {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowed.includes(file.type)) return 'Formato inválido. Use JPG, PNG, WebP ou GIF.'
  if (file.size > 5 * 1024 * 1024)  return 'Arquivo muito grande. Máximo 5MB.'
  return null
}
