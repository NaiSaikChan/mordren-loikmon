import type { MediaAssetType } from '@loikmon/media-standards'

/**
 * Every database column that stores a storage key, and the asset types that
 * belong in it. Usage tracking, unused-asset detection and the "safe to
 * delete?" check all read this list, so a new file column only has to be
 * registered here.
 */
export interface MediaReference {
  /** Stable name shown in the CMS, e.g. `book.cover`. */
  id: string
  entityType: string
  table: string
  /** Column holding the key, or a SQL expression when the key is nested (settings JSON). */
  column: string
  keyExpression?: string
  idColumn: string
  labelColumn: string
  label: string
  assetTypes: readonly MediaAssetType[]
  /** Extra WHERE clause (raw SQL, constant — never user input). */
  where?: string
}

export const MEDIA_REFERENCES: readonly MediaReference[] = [
  { id: 'book.cover', entityType: 'book', table: 'books', column: 'cover_key', idColumn: 'id', labelColumn: 'title', label: 'Book cover', assetTypes: ['book_cover', 'audiobook_cover'] },
  { id: 'book.og_image', entityType: 'book', table: 'books', column: 'og_image_key', idColumn: 'id', labelColumn: 'title', label: 'Book social image', assetTypes: ['og_image'] },
  { id: 'book.pdf', entityType: 'book', table: 'books', column: 'pdf_key', idColumn: 'id', labelColumn: 'title', label: 'Book PDF', assetTypes: ['book_pdf'] },
  { id: 'book.epub', entityType: 'book', table: 'books', column: 'epub_key', idColumn: 'id', labelColumn: 'title', label: 'Book EPUB', assetTypes: ['book_epub'] },
  { id: 'chapter.audio', entityType: 'audio_chapter', table: 'book_audio_chapters', column: 'audio_key', idColumn: 'id', labelColumn: 'title', label: 'Audiobook chapter', assetTypes: ['audio_chapter'] },
  { id: 'article.cover', entityType: 'article', table: 'articles', column: 'thumbnail_key', idColumn: 'id', labelColumn: 'title', label: 'Article cover', assetTypes: ['article_cover'] },
  { id: 'article.og_image', entityType: 'article', table: 'articles', column: 'og_image_key', idColumn: 'id', labelColumn: 'title', label: 'Article social image', assetTypes: ['og_image'] },
  { id: 'article.audio', entityType: 'article', table: 'articles', column: 'audio_key', idColumn: 'id', labelColumn: 'title', label: 'Article narration', assetTypes: ['article_narration'] },
  { id: 'author.avatar', entityType: 'author', table: 'authors', column: 'avatar_key', idColumn: 'id', labelColumn: 'name', label: 'Author avatar', assetTypes: ['author_avatar'] },
  { id: 'category.icon', entityType: 'category', table: 'categories', column: 'thumbnail_key', idColumn: 'id', labelColumn: 'name', label: 'Category icon', assetTypes: ['category_icon'] },
  { id: 'category.cover', entityType: 'category', table: 'categories', column: 'cover_key', idColumn: 'id', labelColumn: 'name', label: 'Category cover', assetTypes: ['category_cover'] },
  { id: 'collection.cover', entityType: 'collection', table: 'collections', column: 'thumbnail_key', idColumn: 'id', labelColumn: 'title', label: 'Collection cover', assetTypes: ['collection_cover'] },
  { id: 'slider.desktop', entityType: 'slider', table: 'sliders', column: 'image_key', idColumn: 'id', labelColumn: 'title', label: 'Hero banner (desktop)', assetTypes: ['hero_desktop', 'promo_banner'] },
  { id: 'slider.mobile', entityType: 'slider', table: 'sliders', column: 'mobile_image_key', idColumn: 'id', labelColumn: 'title', label: 'Hero banner (mobile)', assetTypes: ['hero_mobile'] },
  { id: 'plan.image', entityType: 'plan', table: 'subscription_plans', column: 'image_key', idColumn: 'code', labelColumn: 'name', label: 'Membership plan image', assetTypes: ['membership_plan'] },
  { id: 'coupon.banner', entityType: 'coupon', table: 'coupons', column: 'banner_key', idColumn: 'id', labelColumn: 'name', label: 'Coupon banner', assetTypes: ['coupon_banner'] },
  { id: 'policy.thumbnail', entityType: 'policy', table: 'policies', column: 'thumbnail_key', idColumn: 'slug', labelColumn: 'title', label: 'Policy thumbnail', assetTypes: ['policy_thumbnail'] },
  { id: 'user.avatar', entityType: 'user', table: 'users', column: 'image', idColumn: 'id', labelColumn: 'name', label: 'Profile picture', assetTypes: ['user_avatar', 'admin_avatar'] },
  {
    id: 'setting.image',
    entityType: 'setting',
    table: 'settings',
    column: 'value',
    // Settings store JSON; image settings are the ones named `*_key`.
    keyExpression: 'JSON_UNQUOTE(`value`)',
    idColumn: 'setting_key',
    labelColumn: 'setting_key',
    label: 'Website setting',
    assetTypes: ['brand_logo', 'og_image'],
    where: "`setting_key` LIKE '%\\_key'",
  },
]
