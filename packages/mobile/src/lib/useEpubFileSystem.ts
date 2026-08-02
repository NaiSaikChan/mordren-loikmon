/**
 * Custom fileSystem hook for @epubjs-react-native/core.
 *
 * The published @epubjs-react-native/expo-file-system adapter imports from
 * "expo-file-system" (the new v57 API), which deliberately throws for all
 * legacy methods (writeAsStringAsync, readAsStringAsync, etc.).
 * This hook is a drop-in replacement that imports from "expo-file-system/legacy"
 * where those methods still work.
 */
import { useCallback, useState } from 'react'
import * as FileSystem from 'expo-file-system/legacy'

export function useEpubFileSystem() {
  const [file, setFile] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [downloading, setDownloading] = useState(false)
  const [size, setSize] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const downloadFile = useCallback(
    async (
      fromUrl: string,
      toFile: string,
    ): Promise<{ uri: string | null; mimeType: string | null }> => {
      const callback = (downloadProgress: FileSystem.DownloadProgressData) => {
        const currentProgress = Math.round(
          (downloadProgress.totalBytesWritten /
            downloadProgress.totalBytesExpectedToWrite) *
            100,
        )
        setProgress(currentProgress)
      }

      const downloadResumable = FileSystem.createDownloadResumable(
        fromUrl,
        FileSystem.documentDirectory + toFile,
        { cache: true },
        callback,
      )

      setDownloading(true)
      return downloadResumable
        .downloadAsync()
        .then((value) => {
          if (!value) throw new Error('Download failed')
          if (value.headers['Content-Length']) {
            setSize(Number(value.headers['Content-Length']))
          }
          setSuccess(true)
          setError(null)
          setFile(value.uri)
          return { uri: value.uri, mimeType: value.mimeType ?? null }
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : 'Error downloading file'
          setError(msg)
          return { uri: null, mimeType: null }
        })
        .finally(() => setDownloading(false))
    },
    [],
  )

  const getFileInfo = useCallback(async (fileUri: string) => {
    const info = await FileSystem.getInfoAsync(fileUri)
    return {
      uri: info.uri,
      exists: info.exists,
      isDirectory: info.isDirectory,
      size: info.exists && !info.isDirectory ? info.size : undefined,
    }
  }, [])

  return {
    file,
    progress,
    downloading,
    size,
    error,
    success,
    documentDirectory: FileSystem.documentDirectory,
    cacheDirectory: FileSystem.cacheDirectory,
    bundleDirectory: (FileSystem as unknown as { bundleDirectory?: string }).bundleDirectory ?? undefined,
    readAsStringAsync: FileSystem.readAsStringAsync,
    writeAsStringAsync: FileSystem.writeAsStringAsync,
    deleteAsync: FileSystem.deleteAsync,
    downloadFile,
    getFileInfo,
  }
}
