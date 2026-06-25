import type { ApiResponse } from '../types.js'
import { getClient } from '../client.js'

export interface Album {
  id: string | number
  title: string
  cover?: string
  cover_url?: string
  tracks_count?: number
}

export interface Track {
  id: string | number
  title: string
  audio_url?: string
  duration?: number
  album_id?: string | number
}

export const media = {
  fetchAlbums: (params?: Record<string, unknown>) =>
    getClient().post<ApiResponse<{ albums: Album[] }>>('fetchalbums', params ?? {}),

  getAlbum: (id: string | number) =>
    getClient().post<ApiResponse<{ album: Album; tracks: Track[] }>>('getalbum', { id }),

  fetchTracks: (albumId: string | number) =>
    getClient().post<ApiResponse<{ tracks: Track[] }>>('fetchtracks', { album_id: albumId }),
}
