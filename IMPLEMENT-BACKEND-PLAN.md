# Backend Implementation Plan: Node.js + MySQL + Better Auth

## Executive Summary

This plan details the migration of the **Loikmon** backend from the Flutter-based `loikmon-zcro` backend (currently serving from `https://loikmon.org/webapis/`) to a **modern, native Node.js + Express + MySQL** backend integrated directly into the `mordren-loikmon` monorepo.

**Key Goals:**
- Replace the upstream Flutter API with a maintainable Node.js Express server
- Implement production-grade authentication using **Better Auth**
- Use **MySQL** as the persistent data store
- Maintain API compatibility with existing clients (web, mobile)
- Build a scalable, TypeScript-based architecture

---

## Phase Overview

| Phase | Focus | Duration | Status |
|-------|-------|----------|--------|
| **Phase 1** | Project setup, database schema, core auth | 2-3 weeks | Design |
| **Phase 2** | Content endpoints (books, articles, authors) | 3-4 weeks | Planned |
| **Phase 3** | Purchase & payment system | 3-4 weeks | Planned |
| **Phase 4** | Search, reviews, notifications | 2-3 weeks | Planned |
| **Phase 5** | Testing, deployment, production hardening | 2 weeks | Planned |

---

## Phase 1: Foundation & Authentication (Weeks 1-3)

### 1.1 Project Structure

Extend the monorepo to include a full backend package:

```
packages/
├─ api/              (shared TypeScript API client)
├─ server/           (Node.js BFF → existing, will be updated)
├─ web/              (Vue 3 frontend)
├─ mobile/           (React Native / Expo)
└─ backend/          ← NEW: Core data + auth backend
   ├─ src/
   │  ├─ auth/               # Better Auth integration
   │  │  ├─ config.ts         # Better Auth initialization
   │  │  ├─ adapters.ts       # MySQL adapter
   │  │  └─ plugins.ts        # Custom plugins (device tracking)
   │  ├─ database/
   │  │  ├─ schema.sql        # MySQL schema (init)
   │  │  ├─ migrations/       # Version-controlled migrations
   │  │  └─ client.ts         # Database connection pool
   │  ├─ routes/
   │  │  ├─ auth.ts           # Auth endpoints
   │  │  ├─ users.ts          # User profile, coins, library
   │  │  ├─ books.ts          # Book catalog, chapters
   │  │  ├─ articles.ts       # Article content
   │  │  ├─ authors.ts        # Author profiles, follow
   │  │  ├─ categories.ts     # Category/subcategory browsing
   │  │  ├─ purchases.ts      # Purchase/payment handling
   │  │  ├─ reviews.ts        # Reviews & comments
   │  │  ├─ search.ts         # Full-text search
   │  │  ├─ media.ts          # Audio/media endpoints
   │  │  └─ misc.ts           # Health, status checks
   │  ├─ services/
   │  │  ├─ userService.ts    # User business logic
   │  │  ├─ bookService.ts    # Book catalog & inventory
   │  │  ├─ purchaseService.ts # Purchase workflow
   │  │  ├─ paymentService.ts  # Payment provider integrations
   │  │  ├─ emailService.ts    # Email verification, notifications
   │  │  └─ searchService.ts   # Search engine (Elasticsearch/Typesense alt.)
   │  ├─ middleware/
   │  │  ├─ auth.ts           # JWT/session validation
   │  │  ├─ rateLimit.ts       # Rate limiting
   │  │  ├─ errorHandler.ts    # Centralized error handling
   │  │  └─ validation.ts      # Input sanitization
   │  ├─ types/
   │  │  └─ index.ts          # Shared TypeScript types
   │  ├─ utils/
   │  │  ├─ logger.ts         # Structured logging
   │  │  ├─ crypto.ts         # Encryption helpers
   │  │  └─ pagination.ts     # Pagination logic
   │  └─ index.ts             # Express app entry point
   ├─ tests/
   │  ├─ unit/                # Service & utility tests
   │  ├─ integration/         # API endpoint tests
   │  └─ fixtures/            # Test data
   ├─ docker/                 # Dockerfile for backend
   ├─ migrations/             # DB migration files
   ├─ .env.example
   ├─ package.json
   └─ tsconfig.json
```

### 1.2 Tech Stack & Dependencies

**Core Backend:**
```json
{
  "dependencies": {
    "express": "^5.0.0",
    "better-auth": "^0.x.x",
    "mysql2": "^3.8.0",
    "drizzle-orm": "^0.30.0",
    "drizzle-kit": "^0.20.0",
    "dotenv": "^16.4.5",
    "cors": "^2.8.5",
    "morgan": "^1.10.0",
    "multer": "^1.4.5-lts.1",
    "axios": "^1.7.2",
    "zod": "^3.22.0",
    "pino": "^8.17.2",
    "pino-http": "^8.6.1",
    "bcrypt": "^5.1.1",
    "jsonwebtoken": "^9.1.2"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.14.2",
    "@types/bcrypt": "^5.0.2",
    "vitest": "^4.1.10",
    "supertest": "^7.2.2",
    "tsx": "^4.15.1",
    "typescript": "^5.4.5"
  }
}
```

**Why these choices:**
- **Better Auth**: Framework-agnostic auth with plugins for sessions, OAuth, MFA, device tracking
- **Drizzle ORM**: Type-safe SQL queries with MySQL support, zero-runtime overhead
- **MySQL2**: High-performance driver with built-in connection pooling
- **Zod**: Runtime schema validation for request payloads
- **Pino**: Structured logging (JSON) for production observability

### 1.3 Database Schema (MySQL)

Create `packages/backend/database/schema.sql`:

```sql
-- ───────────────────────────────────────────────────────────────────────
-- Users & Authentication
-- ───────────────────────────────────────────────────────────────────────

CREATE TABLE `users` (
  `id` CHAR(36) PRIMARY KEY COMMENT 'UUID',
  `email` VARCHAR(255) UNIQUE NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `firstname` VARCHAR(100),
  `lastname` VARCHAR(100),
  `username` VARCHAR(100) UNIQUE,
  `phone` VARCHAR(20),
  `avatar_url` TEXT,
  `is_author` BOOLEAN DEFAULT FALSE,
  `is_seller` BOOLEAN DEFAULT FALSE,
  `is_admin` BOOLEAN DEFAULT FALSE,
  `email_verified` BOOLEAN DEFAULT FALSE,
  `email_verified_at` TIMESTAMP,
  `last_login` TIMESTAMP,
  `coins_balance` DECIMAL(15, 2) DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_username (username),
  INDEX idx_is_author (is_author)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `user_sessions` (
  `id` VARCHAR(255) PRIMARY KEY,
  `user_id` CHAR(36) NOT NULL,
  `token` VARCHAR(500) NOT NULL,
  `expires_at` TIMESTAMP NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `user_devices` (
  `id` CHAR(36) PRIMARY KEY,
  `user_id` CHAR(36) NOT NULL,
  `device_id` VARCHAR(255) NOT NULL COMMENT 'Device identifier from client',
  `device_model` VARCHAR(255),
  `platform` ENUM('ios', 'android', 'web') NOT NULL,
  `last_login` TIMESTAMP,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_device (user_id, device_id),
  INDEX idx_user_id (user_id),
  INDEX idx_platform (platform)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────────────────────────────────────────────────────────────
-- Content: Books, Authors, Articles
-- ───────────────────────────────────────────────────────────────────────

CREATE TABLE `categories` (
  `id` CHAR(36) PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `slug` VARCHAR(255) UNIQUE NOT NULL,
  `description` TEXT,
  `icon_url` TEXT,
  `display_order` INT DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_slug (slug),
  INDEX idx_display_order (display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `authors` (
  `id` CHAR(36) PRIMARY KEY,
  `user_id` CHAR(36) UNIQUE NOT NULL COMMENT 'Link to users table if author is a registered user',
  `name` VARCHAR(255) NOT NULL,
  `slug` VARCHAR(255) UNIQUE NOT NULL,
  `bio` TEXT,
  `avatar_url` TEXT,
  `email` VARCHAR(255),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_slug (slug),
  INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `books` (
  `id` CHAR(36) PRIMARY KEY,
  `author_id` CHAR(36) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `slug` VARCHAR(255) UNIQUE NOT NULL,
  `description` TEXT,
  `category_id` CHAR(36),
  `cover_url` TEXT,
  `thumbnail_url` TEXT,
  `price` DECIMAL(10, 2) NOT NULL DEFAULT 0,
  `currency` VARCHAR(3) DEFAULT 'USD',
  `isbn` VARCHAR(20) UNIQUE,
  `pages` INT,
  `language` VARCHAR(10) DEFAULT 'en',
  `published_date` DATE,
  `file_url` TEXT COMMENT 'PDF/EPUB file URL or S3 path',
  `file_type` ENUM('pdf', 'epub') DEFAULT 'pdf',
  `view_count` INT DEFAULT 0,
  `rating_avg` DECIMAL(3, 2),
  `rating_count` INT DEFAULT 0,
  `is_published` BOOLEAN DEFAULT TRUE,
  `is_free` BOOLEAN DEFAULT FALSE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  INDEX idx_author_id (author_id),
  INDEX idx_category_id (category_id),
  INDEX idx_slug (slug),
  INDEX idx_is_published (is_published),
  FULLTEXT INDEX ft_title_description (title, description)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `book_chapters` (
  `id` CHAR(36) PRIMARY KEY,
  `book_id` CHAR(36) NOT NULL,
  `chapter_number` INT NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `content` LONGTEXT,
  `page_start` INT,
  `page_end` INT,
  `is_preview` BOOLEAN DEFAULT FALSE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  INDEX idx_book_id (book_id),
  INDEX idx_chapter_number (chapter_number),
  UNIQUE KEY unique_chapter (book_id, chapter_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `audiobooks` (
  `id` CHAR(36) PRIMARY KEY,
  `book_id` CHAR(36) NOT NULL UNIQUE,
  `narrator` VARCHAR(255),
  `duration_seconds` INT,
  `audio_url` TEXT COMMENT 'S3 or CDN URL',
  `format` ENUM('mp3', 'm4b', 'aac') DEFAULT 'mp3',
  `bitrate` INT COMMENT 'kbps',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  INDEX idx_book_id (book_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `articles` (
  `id` CHAR(36) PRIMARY KEY,
  `author_id` CHAR(36) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `slug` VARCHAR(255) UNIQUE NOT NULL,
  `content` LONGTEXT NOT NULL,
  `excerpt` TEXT,
  `category_id` CHAR(36),
  `featured_image_url` TEXT,
  `thumbnail_url` TEXT,
  `price` DECIMAL(10, 2) DEFAULT 0,
  `view_count` INT DEFAULT 0,
  `rating_avg` DECIMAL(3, 2),
  `rating_count` INT DEFAULT 0,
  `is_published` BOOLEAN DEFAULT TRUE,
  `is_free` BOOLEAN DEFAULT FALSE,
  `published_date` TIMESTAMP,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  INDEX idx_author_id (author_id),
  INDEX idx_category_id (category_id),
  INDEX idx_slug (slug),
  INDEX idx_is_published (is_published),
  FULLTEXT INDEX ft_title_content (title, content)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────────────────────────────────────────────────────────────
-- User Interactions: Library, Bookmarks, Following
-- ───────────────────────────────────────────────────────────────────────

CREATE TABLE `user_library` (
  `id` CHAR(36) PRIMARY KEY,
  `user_id` CHAR(36) NOT NULL,
  `book_id` CHAR(36) NOT NULL,
  `added_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  UNIQUE KEY unique_library_item (user_id, book_id),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `bookmarks` (
  `id` CHAR(36) PRIMARY KEY,
  `user_id` CHAR(36) NOT NULL,
  `book_id` CHAR(36) NOT NULL,
  `chapter_id` CHAR(36),
  `page_number` INT,
  `position_percent` DECIMAL(5, 2) COMMENT 'Progress %: 0-100',
  `note` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  FOREIGN KEY (chapter_id) REFERENCES book_chapters(id) ON DELETE SET NULL,
  UNIQUE KEY unique_bookmark (user_id, book_id),
  INDEX idx_user_id (user_id),
  INDEX idx_book_id (book_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `author_followers` (
  `id` CHAR(36) PRIMARY KEY,
  `user_id` CHAR(36) NOT NULL,
  `author_id` CHAR(36) NOT NULL,
  `followed_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE CASCADE,
  UNIQUE KEY unique_follow (user_id, author_id),
  INDEX idx_user_id (user_id),
  INDEX idx_author_id (author_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────────────────────────────────────────────────────────────
-- Reviews & Ratings
-- ───────────────────────────────────────────────────────────────────────

CREATE TABLE `reviews` (
  `id` CHAR(36) PRIMARY KEY,
  `user_id` CHAR(36) NOT NULL,
  `book_id` CHAR(36),
  `article_id` CHAR(36),
  `rating` INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  `title` VARCHAR(255),
  `content` TEXT NOT NULL,
  `is_spoiler` BOOLEAN DEFAULT FALSE,
  `helpful_count` INT DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_book_id (book_id),
  INDEX idx_article_id (article_id),
  INDEX idx_rating (rating)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `review_replies` (
  `id` CHAR(36) PRIMARY KEY,
  `review_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `content` TEXT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_review_id (review_id),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────────────────────────────────────────────────────────────
-- Purchases & Payments (Phase 2)
-- ───────────────────────────────────────────────────────────────────────

CREATE TABLE `purchases` (
  `id` CHAR(36) PRIMARY KEY,
  `user_id` CHAR(36) NOT NULL,
  `book_id` CHAR(36),
  `article_id` CHAR(36),
  `purchase_price` DECIMAL(10, 2) NOT NULL,
  `currency` VARCHAR(3) DEFAULT 'USD',
  `payment_method` ENUM('credit_card', 'paypal', 'coins', 'bank_transfer') NOT NULL,
  `payment_status` ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending',
  `transaction_id` VARCHAR(255),
  `purchased_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `expires_at` TIMESTAMP COMMENT 'Rental expiry (null = permanent ownership)',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE SET NULL,
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_payment_status (payment_status),
  INDEX idx_purchased_at (purchased_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `coin_packages` (
  `id` CHAR(36) PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `coins_amount` INT NOT NULL,
  `price` DECIMAL(10, 2) NOT NULL,
  `currency` VARCHAR(3) DEFAULT 'USD',
  `bonus_coins` INT DEFAULT 0,
  `display_order` INT DEFAULT 0,
  `is_active` BOOLEAN DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `coin_transactions` (
  `id` CHAR(36) PRIMARY KEY,
  `user_id` CHAR(36) NOT NULL,
  `amount` DECIMAL(15, 2) NOT NULL,
  `type` ENUM('earn', 'spend', 'refund', 'bonus') NOT NULL,
  `reason` VARCHAR(255),
  `related_purchase_id` CHAR(36),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (related_purchase_id) REFERENCES purchases(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_type (type),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `coupons` (
  `id` CHAR(36) PRIMARY KEY,
  `code` VARCHAR(50) UNIQUE NOT NULL,
  `type` ENUM('discount_percent', 'discount_amount', 'free_book', 'coins') NOT NULL,
  `value` DECIMAL(10, 2),
  `book_id` CHAR(36) COMMENT 'For book-specific coupons',
  `max_uses` INT,
  `current_uses` INT DEFAULT 0,
  `valid_from` TIMESTAMP,
  `valid_until` TIMESTAMP,
  `is_active` BOOLEAN DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE SET NULL,
  UNIQUE KEY unique_code (code),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `coupon_redemptions` (
  `id` CHAR(36) PRIMARY KEY,
  `coupon_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `purchase_id` CHAR(36),
  `redeemed_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE SET NULL,
  INDEX idx_coupon_id (coupon_id),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────────────────────────────────────────────────────────────
-- Notifications & Inbox
-- ───────────────────────────────────────────────────────────────────────

CREATE TABLE `notifications` (
  `id` CHAR(36) PRIMARY KEY,
  `user_id` CHAR(36) NOT NULL,
  `type` ENUM('payment', 'review', 'new_book', 'follow', 'promotion') NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `message` TEXT,
  `data` JSON COMMENT 'Additional metadata',
  `is_read` BOOLEAN DEFAULT FALSE,
  `read_at` TIMESTAMP,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_is_read (is_read),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 1.4 Better Auth Setup

Create `packages/backend/src/auth/config.ts`:

```typescript
import { betterAuth } from 'better-auth'
import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'

// Initialize database connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'loikmon',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
})

export const db = drizzle(pool)

/**
 * Initialize Better Auth with MySQL adapter.
 * Better Auth handles:
 * - Session management
 * - Password hashing (bcrypt)
 * - Email verification
 * - Reset password flows
 * - OAuth (optional plugins)
 * - MFA (optional plugins)
 */
export const auth = betterAuth({
  secret: process.env.AUTH_SECRET || 'dev-secret-change-in-production',
  baseURL: process.env.AUTH_BASE_URL || 'http://localhost:4001',
  basePath: '/api/auth', // All auth routes under /api/auth/*
  database: {
    db: db,
    type: 'mysql2', // or 'mysql' via better-auth adapter
  },
  emailAndPassword: {
    enabled: true, // Email + password login
    minPasswordLength: 8,
    requireEmailVerification: process.env.NODE_ENV === 'production',
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60, // Refresh every hour
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 min cache
    },
  },
  plugins: [
    // Custom device tracking plugin (see 1.4.1)
    // deviceTrackingPlugin(),
  ],
})

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.User
```

**Key Better Auth Features:**
- **Email + Password**: Built-in hashing & validation
- **Session Management**: Automatic expiry, refresh tokens
- **Email Verification**: Optional but recommended for production
- **Password Reset**: Secure token-based flow
- **Type Safety**: Full TypeScript inference

### 1.5 Migration to Independent Backend

**Update root `packages/server/` to act as a reverse proxy** to the new backend:

The existing `packages/server` (BFF) will now:
1. Proxy requests to the **new `packages/backend`** instead of `https://loikmon.org/webapis/`
2. Add middleware for CORS, rate limiting, logging
3. Handle transparent fallback if needed during migration

Update `packages/server/package.json`:
```json
{
  "name": "@loikmon/server",
  "dependencies": {
    "http-proxy-middleware": "^3.0.0"
  }
}
```

Update `packages/server/src/index.ts`:
```typescript
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4001'

app.use(
  createProxyMiddleware({
    target: BACKEND_URL,
    changeOrigin: true,
    pathRewrite: { '^/api': '/api' },
  }),
)
```

---

## Phase 2: Content Endpoints (Books, Articles, Authors)

### 2.1 Book Service & Routes

`packages/backend/src/services/bookService.ts`:

```typescript
import { db } from '@/database/client'
import { books, bookChapters } from '@/database/schema'
import { eq, like, desc, and, sql } from 'drizzle-orm'

export class BookService {
  async fetchBooks(page: number = 0, limit: number = 20, filters?: {
    category_id?: string
    is_free?: boolean
    language?: string
  }) {
    const offset = page * limit
    
    const result = await db
      .select()
      .from(books)
      .where(and(
        eq(books.is_published, true),
        filters?.category_id ? eq(books.category_id, filters.category_id) : undefined,
        filters?.is_free ? eq(books.is_free, filters.is_free) : undefined,
        filters?.language ? eq(books.language, filters.language) : undefined,
      ))
      .limit(limit)
      .offset(offset)

    const total = await db
      .select({ count: sql`COUNT(*)`.mapWith(Number) })
      .from(books)

    return {
      books: result,
      pagination: {
        page,
        limit,
        total: total[0].count,
        pages: Math.ceil(total[0].count / limit),
      },
    }
  }

  async getBookById(bookId: string, userEmail?: string) {
    const book = await db
      .select()
      .from(books)
      .where(eq(books.id, bookId))
      .limit(1)

    if (!book.length) throw new Error('Book not found')

    // Increment view count
    await db
      .update(books)
      .set({ view_count: sql`view_count + 1` })
      .where(eq(books.id, bookId))

    return book[0]
  }

  async getBookChapters(bookId: string, userOwnsPurchase?: boolean) {
    // If user doesn't own the book, return preview chapters only
    const chapters = await db
      .select()
      .from(bookChapters)
      .where(
        and(
          eq(bookChapters.book_id, bookId),
          userOwnsPurchase ? undefined : eq(bookChapters.is_preview, true),
        ),
      )

    return chapters
  }

  // ... more methods
}
```

`packages/backend/src/routes/books.ts`:

```typescript
import { Router } from 'express'
import { auth } from '@/auth/config'
import { BookService } from '@/services/bookService'
import { z } from 'zod'

const router = Router()
const bookService = new BookService()

// List books with pagination
router.post('/list', async (req, res) => {
  try {
    const schema = z.object({
      page: z.number().int().min(0).default(0),
      category_id: z.string().optional(),
      language: z.string().optional(),
    })

    const body = schema.parse(req.body?.data || {})
    const result = await bookService.fetchBooks(body.page, 20, body)

    res.json({
      status: 'ok',
      ...result,
    })
  } catch (err) {
    res.status(400).json({ status: 'error', message: (err as Error).message })
  }
})

// Get book detail + chapters
router.post('/detail', async (req, res) => {
  try {
    const schema = z.object({
      id: z.string().uuid(),
    })

    const { id } = schema.parse(req.body?.data || {})
    const session = await auth.api.getSession({ headers: req.headers })

    const book = await bookService.getBookById(id)
    const chapters = await bookService.getBookChapters(id, session?.user?.id)

    res.json({
      status: 'ok',
      book,
      chapters,
    })
  } catch (err) {
    res.status(400).json({ status: 'error', message: (err as Error).message })
  }
})

export default router
```

### 2.2 Search Implementation

**Option A: MySQL Full-Text Search (Built-in)**
```typescript
const search = await db
  .select()
  .from(books)
  .where(sql`MATCH(title, description) AGAINST(${query} IN BOOLEAN MODE)`)
```

**Option B: Typesense (Better for large datasets)**
```bash
npm install typesense
```
- Self-hosted search engine with typo tolerance & facets
- Syncs from MySQL automatically
- Returns results in <50ms

**Option C: Elasticsearch (Enterprise)**
- Most powerful but heavier
- Use if you anticipate >1M books

**Recommendation:** Start with **MySQL Full-Text** (Phase 1), upgrade to **Typesense** in Phase 2 as scale grows.

---

## Phase 3: Purchase & Payment System

### 3.1 Payment Providers

Support multiple payment methods:

1. **Stripe** (credit/debit cards, Apple Pay)
   ```bash
   npm install stripe
   ```

2. **PayPal** (alternative payment method)
   ```bash
   npm install paypal-checkout-sdk
   ```

3. **Bank Transfer** (for regions without card access)
   - Manual proof upload + admin approval

4. **Coins System** (In-app currency)
   - Fixed coin packages
   - Spend coins on books/articles

### 3.2 Purchase Workflow

`packages/backend/src/services/purchaseService.ts`:

```typescript
export class PurchaseService {
  async purchaseBook(userId: string, bookId: string, paymentMethod: 'coins' | 'stripe' | 'paypal') {
    // 1. Check if already purchased
    const existing = await db
      .select()
      .from(purchases)
      .where(
        and(
          eq(purchases.user_id, userId),
          eq(purchases.book_id, bookId),
          eq(purchases.payment_status, 'completed'),
        ),
      )
      .limit(1)

    if (existing.length) throw new Error('Already purchased')

    // 2. Get book price
    const book = await db.select().from(books).where(eq(books.id, bookId))
    if (!book.length) throw new Error('Book not found')

    // 3. Process payment based on method
    switch (paymentMethod) {
      case 'coins':
        return this.purchaseWithCoins(userId, book[0])
      case 'stripe':
        return this.purchaseWithStripe(userId, book[0])
      case 'paypal':
        return this.purchaseWithPayPal(userId, book[0])
    }
  }

  private async purchaseWithCoins(userId: string, book: typeof books.$inferSelect) {
    const user = await db.select().from(users).where(eq(users.id, userId))
    const userCoins = user[0].coins_balance

    if (userCoins < book.price) {
      throw new Error('Insufficient coins')
    }

    // Create purchase record
    const purchaseId = crypto.randomUUID()
    await db.insert(purchases).values({
      id: purchaseId,
      user_id: userId,
      book_id: book.id,
      purchase_price: book.price,
      payment_method: 'coins',
      payment_status: 'completed',
      purchased_at: new Date(),
    })

    // Deduct coins
    await db
      .update(users)
      .set({ coins_balance: userCoins - book.price })
      .where(eq(users.id, userId))

    // Log transaction
    await db.insert(coinTransactions).values({
      id: crypto.randomUUID(),
      user_id: userId,
      amount: -book.price,
      type: 'spend',
      reason: `Purchased: ${book.title}`,
      related_purchase_id: purchaseId,
    })

    return { status: 'completed', purchase_id: purchaseId }
  }

  private async purchaseWithStripe(userId: string, book: typeof books.$inferSelect) {
    // Initiate Stripe session → redirect to checkout
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: book.currency.toLowerCase(),
            product_data: {
              name: book.title,
              images: [book.cover_url],
            },
            unit_amount: Math.round(book.price * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      metadata: {
        user_id: userId,
        book_id: book.id,
      },
      success_url: `${process.env.APP_URL}/purchase/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL}/purchase/cancel`,
    })

    return { status: 'pending', checkout_url: session.url }
  }
}
```

### 3.3 Webhook Handling

Handle Stripe/PayPal webhooks to update purchase status:

```typescript
router.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'] as string
  const event = stripe.webhooks.constructEvent(
    req.body,
    sig,
    process.env.STRIPE_WEBHOOK_SECRET!,
  )

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    
    // Mark purchase as completed
    await db
      .update(purchases)
      .set({
        payment_status: 'completed',
        transaction_id: session.payment_intent as string,
      })
      .where(
        and(
          eq(purchases.user_id, session.metadata?.user_id!),
          eq(purchases.book_id, session.metadata?.book_id!),
        ),
      )
  }

  res.json({ received: true })
})
```

---

## Phase 4: Search, Reviews, Notifications

### 4.1 Review System

- Users rate & comment on books/articles
- Authors can reply to reviews
- Helpful vote system
- Spoiler tags

### 4.2 Notification System

- In-app notifications (stored in DB)
- Email notifications (via SendGrid/AWS SES)
- Push notifications (Firebase Cloud Messaging for Expo)
- Notification preferences per user

### 4.3 Full-Text Search Enhancement

- Combine MySQL FT + Typesense
- Index: books, articles, authors
- Faceted search: category, price range, rating
- Search suggestions/autocomplete

---

## Phase 5: Testing & Deployment

### 5.1 Testing Strategy

**Unit Tests** (services):
```bash
npm run test:unit
```

**Integration Tests** (API routes):
```bash
npm run test:integration
```

**Example**:
```typescript
describe('POST /api/auth/register', () => {
  it('should create user and return session', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        data: {
          email: 'test@example.com',
          password: 'Password123!',
          firstname: 'John',
        },
      })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(res.body.user.email).toBe('test@example.com')
  })
})
```

### 5.2 Deployment Architecture

```
┌─────────────────────────────────────────┐
│         Frontend Clients                 │
│  Web (Vue) · Mobile (Expo) · Admin       │
└──────────────┬──────────────────────────┘
               │ HTTP/REST
┌──────────────▼──────────────────────────┐
│   Reverse Proxy / Load Balancer         │
│  (Nginx or AWS ALB)                     │
└──────────────┬──────────────────────────┘
               │
   ┌───────────┼────────────┐
   │           │            │
┌──▼─────┐ ┌──▼──────┐ ┌───▼──────┐
│Backend  │ │Backend  │ │Backend   │  (3+ instances)
│Node.js  │ │Node.js  │ │Node.js   │
│:4001    │ │:4001    │ │:4001     │
└──┬──────┘ └──┬──────┘ └───┬──────┘
   └───────────┼────────────┘
               │ (connection pool)
        ┌──────▼──────┐
        │    MySQL    │
        │  (Primary)  │
        └─────────────┘
               │
        ┌──────▼──────┐
        │    MySQL    │
        │  (Replica)  │
        └─────────────┘

Optional (add in Phase 4+):
┌───────────────────────────────┐
│  Redis Cache                  │
│  (Sessions, rate limits)      │
└───────────────────────────────┘

┌───────────────────────────────┐
│  Typesense Search             │
│  (Full-text search index)     │
└───────────────────────────────┘
```

**Deployment Options:**

| Platform | Setup | Cost | Scaling |
|----------|-------|------|---------|
| **Docker Compose** (dev/staging) | `docker-compose.yml` | Free | Manual |
| **AWS ECS + RDS** (recommended) | Terraform | $50-200/mo | Auto |
| **Google Cloud Run** | gcloud CLI | Pay-per-request | Auto |
| **Fly.io** | Lightweight | $5-30/mo | Auto |
| **Self-hosted (VPS)** | SSH + PM2 | $10-50/mo | Manual |

**Recommended for MVP**: **AWS ECS + RDS** or **Fly.io**

### 5.3 Docker Setup

`packages/backend/Dockerfile`:

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
RUN npm ci --only=production
EXPOSE 4001
CMD ["node", "dist/index.js"]
```

`docker-compose.yml` (for local dev):

```yaml
version: '3.8'

services:
  backend:
    build: ./packages/backend
    ports:
      - '4001:4001'
    environment:
      DB_HOST: mysql
      DB_USER: loikmon
      DB_PASSWORD: password
      DB_NAME: loikmon
      AUTH_SECRET: dev-secret-12345
    depends_on:
      - mysql

  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: loikmon
      MYSQL_USER: loikmon
      MYSQL_PASSWORD: password
    ports:
      - '3306:3306'
    volumes:
      - ./packages/backend/database/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql
```

Run: `docker-compose up`

---

## Migration Timeline

### Week 1-3: Phase 1 (Foundation)
- [ ] Setup monorepo structure
- [ ] Create MySQL schema
- [ ] Integrate Better Auth
- [ ] Implement auth routes (login, register, profile)
- [ ] Write unit tests for auth service
- [ ] Deploy backend to staging

### Week 4-7: Phase 2 (Content)
- [ ] Implement books endpoints
- [ ] Implement articles endpoints
- [ ] Implement authors + follow system
- [ ] Integrate full-text search
- [ ] Write integration tests

### Week 8-11: Phase 3 (Purchases)
- [ ] Integrate Stripe
- [ ] Implement coin system
- [ ] Coupon/discount system
- [ ] Payment webhooks
- [ ] Admin dashboard for payments

### Week 12-14: Phase 4 (Social Features)
- [ ] Review system
- [ ] Notifications (email + push)
- [ ] Advanced search (Typesense)
- [ ] Author inbox

### Week 15-16: Phase 5 (Polish)
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Security audit
- [ ] Production deployment
- [ ] Client migration (web + mobile)

**Total**: ~4 months for full implementation

---

## Additional Recommendations

### 1. Environment Configuration

Create `.env.example`:

```env
# Server
NODE_ENV=development
PORT=4001
AUTH_BASE_URL=http://localhost:4001
APP_URL=http://localhost:5173

# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=loikmon
DB_PASSWORD=password
DB_NAME=loikmon

# Auth
AUTH_SECRET=dev-secret-change-in-production

# Payments
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...

# Email
SENDGRID_API_KEY=...
SENDGRID_FROM_EMAIL=noreply@loikmon.org

# Firebase (Push Notifications)
FIREBASE_PROJECT_ID=...
FIREBASE_PRIVATE_KEY=...
FIREBASE_CLIENT_EMAIL=...

# Search
TYPESENSE_API_KEY=...
TYPESENSE_HOST=typesense.example.com

# Logging
LOG_LEVEL=info
```

### 2. Error Handling Strategy

Centralized error handler:

```typescript
// middleware/errorHandler.ts
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error({
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
  })

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      details: (err as any).details,
    })
  }

  res.status(500).json({
    status: 'error',
    message: 'Internal server error',
  })
})
```

### 3. Rate Limiting

```bash
npm install express-rate-limit
```

```typescript
import rateLimit from 'express-rate-limit'

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later',
})

app.use('/api/', limiter)
```

### 4. Security Headers

```bash
npm install helmet
```

```typescript
import helmet from 'helmet'
app.use(helmet())
```

### 5. API Documentation

Use **OpenAPI 3.0** with Swagger:

```bash
npm install swagger-jsdoc swagger-ui-express
```

Accessible at `http://localhost:4001/api-docs`

### 6. Database Migrations

Use **Drizzle Kit** for version-controlled migrations:

```bash
npm run db:generate  # Generate migration from schema changes
npm run db:push     # Apply to database
```

---

## Success Criteria

✅ **Phase 1 Complete When:**
- [ ] Auth endpoints pass all tests
- [ ] Sessions persist correctly
- [ ] Password reset flow works
- [ ] Device tracking works
- [ ] 100% of tests passing

✅ **Full Backend Complete When:**
- [ ] All 50+ endpoints from loikmon-zcro API are implemented
- [ ] Web & mobile clients can be pointed to new backend
- [ ] Performance is equivalent or better (measure with load tests)
- [ ] All payment flows work
- [ ] Zero downtime migration plan in place

---

## Questions to Clarify

Before starting Phase 1, confirm:

1. **Payment Priority**: Should we support Stripe, PayPal, bank transfer, or coins first?
2. **Search Scale**: How many books/articles initially? Will MySQL FT suffice?
3. **Email Provider**: SendGrid, AWS SES, or self-hosted?
4. **Authentication**: Just email + password, or OAuth (Google, Facebook)?
5. **Admin Panel**: Does one exist? Will it be built in Phase 5?
6. **Deployment Preference**: AWS, Google Cloud, Fly.io, or self-hosted?

---

**This plan is a living document. Update as requirements evolve.**
