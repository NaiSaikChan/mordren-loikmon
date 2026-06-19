import type { ApiResponse, MediaItem, Album } from '../types.js'
import { getClient } from '../client.js'

export const media = {
  fetchMedia: (params?: Record<string, unknown>) =>
    getClient().get<ApiResponse<{ media: MediaItem[] }>>('/media/fetch_media', { params }),

  fetchTrending: () =>
    getClient().get<ApiResponse<{ trending: MediaItem[] }>>('/media/getTrendingMedia'),

  fetchLivestreams: () =>
    getClient().get<ApiResponse<{ livestreams: unknown[] }>>('/media/fetch_livestreams'),

  fetchArtistMedia: (artistId: string | number) =>
    getClient().get<ApiResponse<{ media: MediaItem[] }>>('/media/fetch_artists_media', {
      params: { artist_id: artistId },
    }),

  fetchCategoriesMedia: (categoryId: string | number) =>
    getClient().get<ApiResponse<{ media: MediaItem[] }>>('/media/fetch_categories_media', {
      params: { category_id: categoryId },
    }),

  fetchGenreMedia: (genre: string) =>
    getClient().get<ApiResponse<{ media: MediaItem[] }>>('/media/fetch_genre_media', {
      params: { genre },
    }),

  likeUnlike: (mediaId: string | number) =>
    getClient().post<ApiResponse<{ is_liked: boolean }>>('/media/likeunlikemedia', {
      media_id: mediaId,
    }),

  updateMediaViews: (mediaId: string | number) =>
    getClient().post<ApiResponse<null>>('/media/update_media_total_views', { media_id: mediaId }),

  purchaseMedia: (mediaId: string | number, paymentData: Record<string, unknown>) =>
    getClient().post<ApiResponse<null>>('/media/purchase_media', {
      media_id: mediaId,
      ...paymentData,
    }),

  tipMedia: (mediaId: string | number, amount: number) =>
    getClient().post<ApiResponse<null>>('/media/tip_media', { media_id: mediaId, amount }),

  createMedia: (data: Record<string, unknown>) =>
    getClient().post<ApiResponse<MediaItem>>('/media/createMediaApp', data),

  editMedia: (data: Record<string, unknown>) =>
    getClient().post<ApiResponse<MediaItem>>('/media/editMediaApp', data),

  fetchAlbums: (params?: Record<string, unknown>) =>
    getClient().get<ApiResponse<{ albums: Album[] }>>('/media/fetch_albums', { params }),

  fetchAllAlbums: () =>
    getClient().get<ApiResponse<{ albums: Album[] }>>('/media/fetch_all_albums'),

  fetchAlbumMedia: (albumId: string | number) =>
    getClient().get<ApiResponse<{ media: MediaItem[] }>>('/media/fetch_album_media', {
      params: { album_id: albumId },
    }),

  purchaseAlbum: (albumId: string | number, paymentData: Record<string, unknown>) =>
    getClient().post<ApiResponse<null>>('/media/purchase_album', {
      album_id: albumId,
      ...paymentData,
    }),

  fetchMoods: () =>
    getClient().get<ApiResponse<{ moods: string[] }>>('/media/fetch_moods'),

  createAlbum: (data: Record<string, unknown>) =>
    getClient().post<ApiResponse<Album>>('/media/createAlbumApp', data),

  editAlbum: (data: Record<string, unknown>) =>
    getClient().post<ApiResponse<Album>>('/media/editAlbumApp', data),
}
