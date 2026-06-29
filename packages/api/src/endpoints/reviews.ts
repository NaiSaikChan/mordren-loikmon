import { getClient } from '../client.js'

export const reviews = {
  // { id:0, itmid, type:'book'|'article', email? }  → { userreview, reviews:[] }
  loadRecentReviews: (itmid: string|number, type: string, email?: string) =>
    getClient().post<any>('loadrecentreviews', { id: 0, itmid, type, ...(email?{email}:{}) }),

  // { page:'0', type, itmid }
  loadReviews: (itmid: string|number, type: string, page = 0) =>
    getClient().post<any>('loadreviews', { page: String(page), type, itmid }),

  // { content:base64, email, itmid, type, rating }  → { review:{} }
  submitReview: (data: { itmid:string|number; type:string; content:string; rating:number; email?:string }) =>
    getClient().post<any>('submitreview', {
      content: btoa(unescape(encodeURIComponent(data.content))),
      email: data.email ?? '',
      itmid: data.itmid,
      type: data.type,
      rating: data.rating,
    }),

  // { id, content:base64, rating }
  editReview: (id: string|number, content: string, rating: number) =>
    getClient().post<any>('editreview', {
      id,
      content: btoa(unescape(encodeURIComponent(content))),
      rating,
    }),

  // { id }
  deleteReview: (id: string|number) =>
    getClient().post<any>('deletereview', { id }),
}
