-- ============================================================================
-- Migration 001: Subscription model (replaces coin-based purchases)
-- ============================================================================
-- The legacy Flutter backend charged coins per book/article (purchasebook,
-- purchasearticle, purchase_media, getusercoins ...). This schema replaces
-- that with a flat subscription that unlocks ALL content while active.
--
-- Content tables (books, articles, authors, categories) are assumed to be
-- owned/managed elsewhere or synced; here we own identity + entitlements.
-- ============================================================================

-- ---- Users ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            CHAR(36)      NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  email         VARCHAR(255)  NOT NULL,
  name          VARCHAR(255)  NULL,
  password_hash VARCHAR(255)  NULL,          -- null for social-only accounts
  auth_provider VARCHAR(32)   NOT NULL DEFAULT 'password', -- password|google|apple
  is_admin      TINYINT(1)    NOT NULL DEFAULT 0,
  email_verified TINYINT(1)   NOT NULL DEFAULT 0,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- Subscription plans (reference / catalogue mirror) --------------------
-- Source of truth is domain/plans.ts; this table lets admin queries + joins
-- resolve plan metadata and supports reporting.
CREATE TABLE IF NOT EXISTS subscription_plans (
  code          VARCHAR(32)   NOT NULL PRIMARY KEY,  -- monthly|quarterly|semiannual|yearly
  name          VARCHAR(64)   NOT NULL,
  price_usd     DECIMAL(10,2) NOT NULL,
  duration_days INT           NOT NULL,
  display_order INT           NOT NULL DEFAULT 0,
  active        TINYINT(1)    NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- Subscriptions --------------------------------------------------------
-- One row per purchased subscription term across ALL providers. The user's
-- effective access is the MAX(expires_at) among status='active' rows.
CREATE TABLE IF NOT EXISTS subscriptions (
  id                 CHAR(36)     NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  user_id            CHAR(36)     NOT NULL,
  plan_code          VARCHAR(32)  NOT NULL,
  provider           VARCHAR(16)  NOT NULL,   -- google_play|app_store|stripe
  status             VARCHAR(16)  NOT NULL DEFAULT 'pending', -- active|expired|canceled|grace_period|pending
  -- Provider-side identifiers used for idempotency + server notifications:
  provider_txn_id    VARCHAR(255) NULL,       -- Play orderId / Apple originalTransactionId / Stripe sub id
  purchase_token     VARCHAR(1024) NULL,      -- Play purchaseToken / Apple transactionId / Stripe checkout id
  original_txn_id    VARCHAR(255) NULL,       -- ties renewals to the first purchase
  environment        VARCHAR(16)  NOT NULL DEFAULT 'production', -- sandbox|production
  auto_renewing      TINYINT(1)   NOT NULL DEFAULT 0,
  started_at         TIMESTAMP    NULL,
  expires_at         TIMESTAMP    NULL,
  canceled_at        TIMESTAMP    NULL,
  latest_receipt     MEDIUMTEXT   NULL,       -- raw verified payload for audit/debug
  created_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_sub_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_provider_txn (provider, provider_txn_id),
  KEY idx_sub_user_status (user_id, status),
  KEY idx_sub_expires (expires_at),
  KEY idx_sub_original (original_txn_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- Payment events (audit log of every webhook / verification) -----------
-- Append-only. Enables idempotent processing + debugging of billing issues.
CREATE TABLE IF NOT EXISTS payment_events (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  subscription_id CHAR(36)     NULL,
  user_id         CHAR(36)     NULL,
  provider        VARCHAR(16)  NOT NULL,
  event_type      VARCHAR(64)  NOT NULL,   -- e.g. verify, renew, cancel, refund, DID_RENEW ...
  provider_event_id VARCHAR(255) NULL,     -- for idempotency (Stripe event id / Apple notificationUUID)
  payload         MEDIUMTEXT   NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_provider_event (provider, provider_event_id),
  KEY idx_pe_sub (subscription_id),
  KEY idx_pe_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- Content assets (maps logical content to MinIO objects) ---------------
-- Protected content (book files, audio chapters) is delivered via signed URLs
-- only to entitled users. Cover images may be public.
CREATE TABLE IF NOT EXISTS content_assets (
  id           CHAR(36)     NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  content_type VARCHAR(16)  NOT NULL,   -- book|article|audio|image
  content_id   VARCHAR(64)  NOT NULL,   -- external/legacy id of the book/article
  asset_kind   VARCHAR(16)  NOT NULL,   -- file|cover|audio|thumbnail
  bucket       VARCHAR(64)  NOT NULL,
  object_key   VARCHAR(512) NOT NULL,
  is_public    TINYINT(1)   NOT NULL DEFAULT 0,
  mime_type    VARCHAR(128) NULL,
  byte_size    BIGINT       NULL,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_ca_content (content_type, content_id),
  UNIQUE KEY uq_asset (bucket, object_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- Seed the plan catalogue ---------------------------------------------
INSERT INTO subscription_plans (code, name, price_usd, duration_days, display_order, active)
VALUES
  ('monthly',    'Monthly',  4.00,  30,  1, 1),
  ('quarterly',  '3 Months', 10.00, 90,  2, 1),
  ('semiannual', '6 Months', 20.00, 180, 3, 1),
  ('yearly',     'Yearly',   45.00, 365, 4, 1)
ON DUPLICATE KEY UPDATE
  name=VALUES(name), price_usd=VALUES(price_usd),
  duration_days=VALUES(duration_days), display_order=VALUES(display_order), active=VALUES(active)
