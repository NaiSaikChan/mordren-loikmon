# Media asset standards

Every rule about uploaded media (formats, byte limits, aspect ratios, pixel
sizes, thumbnail widths, display shape, processing) is defined once, in
[`packages/media-standards`](../packages/media-standards/src). The backend
(validation, processing, storage, public JSON), the API client and the CMS
(upload controls, media library) all import it. **Change a standard there and
nowhere else**; the tables below are a snapshot for reading. The config is the
source of truth.

| Module | Defines |
| --- | --- |
| `formats.ts` | Accepted formats with their MIME types and extensions, per-category byte limits, the direct-upload threshold |
| `storage.ts` | Storage kinds (first key segment) and the bucket each one uses (public or private) |
| `standards.ts` | One `MediaStandard` per asset type: ratio, recommended, minimum and thumbnail sizes, formats, display shape, fit, Open Graph generation, preview rule |
| `variants.ts` | Thumbnail widths, how variant keys are laid out, encoder settings, decompression-bomb limit |
| `validation.ts` | `validateMediaUpload()`, used by both the browser and the server, plus help-text and `accept` helpers |
| `responsive.ts` | `responsiveImage()` (builds a `srcset` from a key), `openGraphImageUrl()`, `variantForWidth()` |

## Formats and limits

| Category | Formats | Max upload |
| --- | --- | --- |
| Images | JPG, PNG, **WebP (preferred)**, AVIF; SVG only where a standard allows it | 10 MB |
| Documents | PDF, EPUB | 250 MB |
| Audio | MP3, M4A, AAC, WAV | 1 GB |

The server's `UPLOAD_MAX_MB` can only **lower** these limits. The browser's
MIME type is never trusted:

- **Images** are decoded with sharp, which reads the real format and pixel
  size.
- **Documents and audio** are identified from their magic bytes.
- **SVG** files containing scripts, event handlers, `javascript:` URLs,
  entities or embedded documents are rejected.

## Image standards

| Asset type | Ratio | Recommended | Minimum (enforced) | Thumbnail | Display / notes |
| --- | --- | --- | --- | --- | --- |
| `book_cover` | 2:3 | 1600×2400 | 800×1200 | 320×480 | Details, search, library, featured. OG card generated |
| `audiobook_cover` | 1:1 | 2000×2000 | 1000×1000 | 300×300 | Player, library. OG card generated |
| `article_cover` | 16:9 | 1600×900 | 1200×675 | 400×225 | Blog, homepage. OG card generated |
| `author_avatar` | 1:1 | 800×800 | 400×400 | – | Circular |
| `user_avatar` | 1:1 | 800×800 | 300×300 | – | Circular. Processed, but not a library asset |
| `admin_avatar` | 1:1 | 512×512 | – | – | Circular |
| `hero_desktop` | 21:9 | 1920×820 | 1600×685 | – | Uploaded separately from mobile; previewed before upload |
| `hero_mobile` | 4:5 | 1080×1350 | – | – | Uploaded separately; previewed in a phone frame |
| `promo_banner` | 16:9 | 1600×900 | – | – | OG card generated |
| `category_icon` | 1:1 | 256×256 | 128×128 | – | SVG preferred, PNG; transparent background; letterboxed, not cropped |
| `category_cover` | 16:9 | 1600×900 | – | – | OG card generated |
| `collection_cover` | 3:1 | 1800×600 | 1200×400 | – | Featured, curated. OG card generated |
| `membership_plan` | 16:9 | 1200×675 | – | – | |
| `coupon_banner` | 16:9 | 1600×900 | – | – | |
| `policy_thumbnail` | 16:9 | 1200×675 | – | – | |
| `og_image` | 1.91:1 | 1200×630 | – | – | Optional per book or article; generated from the cover when missing |
| `brand_logo` | free | – | – | – | SVG, PNG or WebP (addition: the site logo setting) |
| `library_image` | free | – | – | – | Generic library uploads (addition) |

Documents and audio have their own types: `book_pdf`, `book_epub`,
`audio_chapter` and `article_narration`.

**Validation outcomes.** An upload is rejected (400) when:

- the file is below the minimum size,
- its format is not allowed, or
- it exceeds the byte limit.

It is accepted with a warning when:

- it is below the recommended size,
- it is not in the preferred format, or
- its ratio is more than 2 % off. This tolerance exists because the specified
  pixel sizes are rounded: 1920×820 is 0.35 % off 21:9.

When the ratio is off, the thumbnails are center-cropped using attention-based
positioning. Icons are letterboxed instead.

## Generated files

Each raster or SVG upload is stored exactly as received, plus a set of WebP
renditions. Variant keys are **derived from the original key**, so anything
that holds a key can build a `srcset` without a database lookup:

```
cover/2026-09/<uuid>/original.jpg   upload, byte-for-byte
cover/2026-09/<uuid>/xs.webp        150 px wide  ┐
cover/2026-09/<uuid>/sm.webp        300 px wide  │ cropped/fitted to the standard's ratio,
cover/2026-09/<uuid>/md.webp        600 px wide  │ never upscaled (SVGs are re-rasterised)
cover/2026-09/<uuid>/lg.webp       1200 px wide  ┘
cover/2026-09/<uuid>/webp.webp      full size, original framing (longest edge ≤ 3840)
cover/2026-09/<uuid>/og.jpg         1200×630 social card (standards with generateOpenGraph)
```

- **The OG card** places the image centered over a blurred copy of itself, so
  a portrait book cover is not cut into a strip. It is JPEG because some
  link-preview crawlers still ignore WebP.
- **Public objects** get `Cache-Control: public, max-age=31536000, immutable`,
  which is safe because keys are never reused. Set `MEDIA_CDN_URL` to serve
  public URLs from a CDN that sits in front of the public bucket.
- **Legacy keys** (imported URLs, or keys uploaded before this layout existed)
  have no variants. `responsiveImage()` returns them with `srcset: null`.

### Public JSON

Serializers add responsive descriptors next to the existing flat URL fields:

| Record | Fields |
| --- | --- |
| Book | `cover_image`, `og_image_url` |
| Article | `thumbnail_image`, `og_image_url` |
| Author | `avatar_image` |
| Category | `thumbnail_image`, `cover`, `cover_image` |
| Collection | `cover_image`, `og_image_url` |
| Slider | `image`, `mobile_image`, `mobile_thumbnail` |
| Plan | `image_key`, `image` |
| User | `avatar_image` |

Each descriptor has the shape `{ src, srcset, original, variants }`. The
storefront's `ResponsiveImg.vue` renders them with `srcset`, `sizes` and
`loading="lazy"`. The home slider uses `<picture>` to serve the 4:5 mobile
artwork on phones.

## Media library

**Tables** (migration `0004_media`):

- `media_assets` stores one row per upload: type, dimensions, dominant color,
  checksum, a variants map, total bytes, folder, title and alt text.
- `media_folders` stores the folder tree.
- The same migration adds `sliders.mobile_image_key`, `categories.cover_key`,
  `subscription_plans.image_key`, `coupons.banner_key`,
  `policies.thumbnail_key` and `books` / `articles.og_image_key`.

**Features:**

- **Reuse.** Uploading a file identical to an existing asset of the same type
  (same SHA-256) returns the existing asset. The CMS's "From library" button
  picks any existing asset, and greys out images that are too small for the
  target standard.
- **Usage tracking.** [`media/references.ts`](../packages/backend/src/media/references.ts)
  lists every column that stores a key. Usage counts, the used/unused filter,
  the in-use delete guard and the stats all read that list. **Register any new
  file column there.**
- **Lifecycle.** Library assets outlive content. When a record replaces or
  loses a registered file, the file is kept (`LibraryAwareStorage`) and shows
  up under *Unused*. Deleting an asset from the library removes the original
  and every variant, and assets still in use require an explicit force.
  Unregistered files, such as legacy uploads and profile pictures, are still
  deleted when content releases them.
- **Large files** (documents and audio over 25 MB) are PUT directly to MinIO
  with a presigned URL, then registered with `POST /cms/media/complete`, which
  verifies the object's size and type.

### Endpoints (`/api/v1/cms`)

| Method and path | Permission | Purpose |
| --- | --- | --- |
| `GET /media/standards` | media.upload | Standards, formats, variants and the effective limits, as JSON (for mobile and scripts) |
| `GET /media` | media.upload | List with `q`, `category`, `asset_type`, `folder` (id or `root`), `usage`, `sort`, `page`, `limit` |
| `GET /media/stats` | media.upload | Counts, bytes, unused count |
| `GET /media/:id` | media.upload | Asset details plus usages |
| `PATCH /media/:id` | media.upload | Title, alt text, folder |
| `POST /media/move` | media.upload | Bulk move to a folder |
| `POST /media/resolve` | media.upload | Display data for keys stored on content rows |
| `POST /media` | media.upload | Upload one file (multipart: `file`, `asset_type`, optional `folder_id`, `title`, `alt_text`); `kind` still works as a free-form upload |
| `POST /media/bulk` | media.upload | Upload up to 50 files; each succeeds or fails on its own (207) |
| `POST /media/presign` and `POST /media/complete` | media.upload | Direct-to-storage upload for large documents and audio |
| `POST /media/signed-url` | media.upload | Preview a private file |
| `POST /media/bulk-delete` | media.delete | Delete; in-use assets are skipped unless `force` |
| `DELETE /media/:id` | media.delete | Delete one asset (409 while in use unless `?force=true`) |
| `DELETE /media` | media.delete | Delete by key (older clients) |
| `GET`, `POST`, `PATCH`, `DELETE /media-folders` | media.upload (delete requires media.delete) | Folder tree |

`POST /auth/me/avatar` validates and processes against the `user_avatar`
standard.

## Adding or changing a standard

1. Edit `IMAGE_STANDARDS` (or the document and audio standards) in
   `packages/media-standards/src/standards.ts`.
2. If it is stored on a new column, add a migration and register the column in
   `packages/backend/src/media/references.ts`.
3. Use `<MediaPicker v-model="form.x_key" asset-type="your_type" />` in the
   CMS. Its accept list, help text, validation, frame and preview all follow
   from the standard.
4. Run `npm test -w @loikmon/media-standards`. It checks that sizes match their
   ratios and that the minimum is never above the recommended size.

Standards changes apply to **new uploads**. Existing files keep the variants
they were generated with.
