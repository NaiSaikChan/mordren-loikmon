import { getClient } from '../client.js'
import type { Article, Book, Id, ItemType } from '../types.js'

/** The signed-in user's saved books and articles (synced across devices). */
export const library = {
  list: () => getClient().get<{ status: 'ok'; books: Book[]; articles: Article[] }>('library'),

  add: (itemType: ItemType, id: Id | string) => getClient().put<{ status: 'ok'; in_library: true }>(`library/${itemType}/${id}`),

  remove: (itemType: ItemType, id: Id | string) => getClient().delete<{ status: 'ok'; in_library: false }>(`library/${itemType}/${id}`),
}
