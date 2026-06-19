import type { ApiResponse, Category } from '../types.js'
import { getClient } from '../client.js'

export const categories = {
  fetchCategories: (params?: Record<string, unknown>) =>
    getClient().get<ApiResponse<{ categories: Category[] }>>('/categories/fetchcategories', { params }),

  fetchAppCategories: () =>
    getClient().get<ApiResponse<{ categories: Category[] }>>('/categories/fetch_app_categories'),

  fetchSubCategories: (parentId: string | number) =>
    getClient().get<ApiResponse<{ categories: Category[] }>>('/categories/fetch_sub_categories', {
      params: { parent_id: parentId },
    }),
}
