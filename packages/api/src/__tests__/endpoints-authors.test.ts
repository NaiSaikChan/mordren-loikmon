/**
 * Authors endpoint — unit tests
 * Verifies exact payload shapes sent to the API.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPost = vi.fn()

vi.mock('../client.js', () => ({
  getClient: () => ({ post: mockPost })
}))

import { authors } from '../endpoints/authors.js'

describe('authors endpoint', () => {
  beforeEach(() => {
    mockPost.mockResolvedValue({ data: {} })
    vi.clearAllMocks()
  })

  describe('fetchAuthors()', () => {
    it('posts to fetchauthors with default params', async () => {
      await authors.fetchAuthors()
      expect(mockPost).toHaveBeenCalledWith('fetchauthors', {
        type: 'book', page: '0', query: '', email: ''
      })
    })

    it('passes page as string', async () => {
      await authors.fetchAuthors({ page: 2 })
      expect(mockPost).toHaveBeenCalledWith('fetchauthors', expect.objectContaining({ page: '2' }))
    })

    it('passes query string', async () => {
      await authors.fetchAuthors({ query: 'nai sai' })
      expect(mockPost).toHaveBeenCalledWith('fetchauthors', expect.objectContaining({ query: 'nai sai' }))
    })

    it('passes email param', async () => {
      await authors.fetchAuthors({ email: 'u@test.com' })
      expect(mockPost).toHaveBeenCalledWith('fetchauthors', expect.objectContaining({ email: 'u@test.com' }))
    })
  })

  describe('getAuthorData() / getAuthor()', () => {
    it('posts to get_author_data with author id', async () => {
      await authors.getAuthorData(42)
      expect(mockPost).toHaveBeenCalledWith('get_author_data', { author: 42, email: '' })
    })

    it('getAuthor is an alias for getAuthorData', async () => {
      await authors.getAuthor(7, 'x@x.com')
      expect(mockPost).toHaveBeenCalledWith('get_author_data', { author: 7, email: 'x@x.com' })
    })

    it('email defaults to empty string when omitted', async () => {
      await authors.getAuthor(1)
      expect(mockPost).toHaveBeenCalledWith('get_author_data', { author: 1, email: '' })
    })
  })

  describe('followUnfollow()', () => {
    it('posts to followunfollow with authorId', async () => {
      await authors.followUnfollow(99)
      expect(mockPost).toHaveBeenCalledWith('followunfollow', { author: 99 })
    })

    it('includes email when provided', async () => {
      await authors.followUnfollow(99, 'me@test.com')
      expect(mockPost).toHaveBeenCalledWith('followunfollow', { author: 99, email: 'me@test.com' })
    })
  })
})
