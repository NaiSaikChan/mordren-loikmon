import { getClient } from '../client.js'
import type { Article, Author, AuthorsResponse, Book, Id } from '../types.js'

type AuthorDetailResponse = { status: 'ok'; author: Author; books: Book[]; articles: Article[] }
type FollowResponse = { status: 'ok'; is_following: boolean; followers_count: number }

export const authors = {
  fetchAuthors: (params: { page?: number; limit?: number; q?: string } = {}) =>
    getClient().get<AuthorsResponse>('authors', { params }),

  /** Author profile with their books and articles. */
  getAuthor: (id: Id | string) => getClient().get<AuthorDetailResponse>(`authors/${id}`),

  /** @deprecated alias of getAuthor */
  getAuthorData: (id: Id | string) => getClient().get<AuthorDetailResponse>(`authors/${id}`),

  follow: (id: Id | string) => getClient().put<FollowResponse>(`authors/${id}/follow`),

  unfollow: (id: Id | string) => getClient().delete<FollowResponse>(`authors/${id}/follow`),

  /** Toggle helper: pass the current state. */
  followUnfollow: (id: Id | string, isFollowing: boolean) =>
    isFollowing ? getClient().delete<FollowResponse>(`authors/${id}/follow`) : getClient().put<FollowResponse>(`authors/${id}/follow`),
}
