# Deploying Loikmon on a Hostinger VPS (Docker)

This runs the whole platform on one VPS with Docker Compose, behind the Traefik
reverse proxy that already runs on the server (external network
`aar_traefik_traefik-proxy`, entrypoint `websecure`, certresolver `letsencrypt`).

```
                    Internet (HTTPS, Let's Encrypt via Traefik)
          ┌──────────────────────┬──────────────────────┬──────────────────────┐
   app.loikmon.org        api.loikmon.org        storage.loikmon.org
          │                      │                      │
   ┌──────▼──────┐        ┌──────▼──────┐        ┌──────▼──────┐
   │ web (nginx) │─/api──▶│  backend    │───────▶│   MinIO     │  public covers +
   │ Vue SPA     │        │  Node 22    │  S3    │  :9000      │  signed book/audio URLs
   └─────────────┘        └──────┬──────┘        └─────────────┘
   Android / iOS apps ──────────▲│                console: 127.0.0.1:9001 (SSH tunnel)
   Apple & Google webhooks ─────┘│
                          ┌──────▼──────┐        ┌─────────────┐
                          │  MySQL 8.4  │◀───────│  db-backup  │ nightly dumps → ./backups/mysql
                          └─────────────┘        └─────────────┘
```

| Service   | Image                                   | Public?                  |
|-----------|-----------------------------------------|--------------------------|
| backend   | built from `packages/backend/Dockerfile` | `API_DOMAIN`             |
| web       | built from `packages/web/Dockerfile`     | `APP_DOMAIN`             |
| minio     | `quay.io/minio/minio` (pinned)           | `STORAGE_DOMAIN` (S3 API) |
| mysql     | `mysql:8.4`                              | no                       |
| db-backup | `mysql:8.4`                              | no                       |

> MinIO stopped publishing community images to Docker Hub in 2025; the compose
> file pins the last public release from quay.io. The backend only uses the
> standard S3 API, so any S3-compatible store can replace it later.

---

## 1. One-time server preparation

1. **DNS**: create `A` records for `app`, `api` and `storage` (e.g. `app.loikmon.org`) pointing at the VPS IP.
2. **Docker**: Docker Engine ≥ 24 with the Compose plugin (`docker compose version`).
3. **Traefik**: confirm the network exists: `docker network ls | grep aar_traefik_traefik-proxy`.
4. **Firewall**: only 22, 80 and 443 need to be open. MySQL (3306) and MinIO (9000/9001) are not published.

## 2. First deployment

```bash
git clone https://github.com/<you>/mordren-loikmon.git && cd mordren-loikmon
git checkout feat/backend-subscription-iap        # or main once merged

cp .env.production.example .env.production
openssl rand -base64 48   # use for AUTH_SECRET
openssl rand -base64 24   # use for DB_PASSWORD, MYSQL_ROOT_PASSWORD, MINIO_SECRET_KEY
nano .env.production       # domains, secrets, SMTP, store credentials (section 4)

docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

On first boot the backend automatically:
- runs the database migrations (Better Auth tables + application tables + the four plans),
- creates the MinIO buckets (`loikmon-public` with anonymous read, `loikmon-private`),
- starts the hourly subscription reconciliation job.

Check it:

```bash
curl https://api.loikmon.org/health          # {"status":"ok",...}
curl https://api.loikmon.org/health/ready    # database + storage checks, enabled integrations
curl https://api.loikmon.org/api/v1/subscriptions/plans
```

**Create the admin account**: register in the web app or mobile app with an email
listed in `ADMIN_EMAILS` — it gets the `admin` role automatically.

### Import the existing catalogue

```bash
# Metadata only (file columns keep the legacy URLs, content is browsable immediately)
docker compose --env-file .env.production -f docker-compose.prod.yml exec backend node dist/cli/import-legacy.js
# Copy covers, PDFs, EPUBs and audio into MinIO (resumable; re-run until it reports no failures)
docker compose --env-file .env.production -f docker-compose.prod.yml exec backend node dist/cli/import-legacy.js --files
# Optional: make every imported title subscriber-only (legacy "amount 0" items stay free otherwise)
docker compose --env-file .env.production -f docker-compose.prod.yml exec backend node dist/cli/import-legacy.js --all-paid
```

User accounts cannot be exported from the old API. With `LEGACY_API_BASE` set,
an existing user who signs in for the first time is verified against the old
API once and recreated locally with the same password.

### GitHub Pages build of the web app

`deploy.yml` builds the SPA with `VITE_API_BASE=https://api.loikmon.org/api/v1`.
Allow its origin on the server: `EXTRA_CORS_ORIGINS=,https://<user>.github.io`.

## 3. Updating and rolling back

```bash
git pull
IMAGE_TAG=$(git rev-parse --short HEAD) docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker image prune -f
```

Migrations run automatically and are forward-only. To roll back application
code, check out the previous commit and rebuild (restore a backup first if a
migration must be undone).

## 4. App store configuration (subscriptions)

Plans are seeded as:

| Code         | Price | Period   | App Store product id                     | Google Play product / base plan |
|--------------|-------|----------|------------------------------------------|---------------------------------|
| `monthly`    | $4    | 1 month  | `org.loikmon.mobile.premium.monthly`     | `loikmon_premium` / `monthly`   |
| `quarterly`  | $10   | 3 months | `org.loikmon.mobile.premium.quarterly`   | `loikmon_premium` / `quarterly` |
| `semiannual` | $20   | 6 months | `org.loikmon.mobile.premium.semiannual`  | `loikmon_premium` / `semiannual`|
| `yearly`     | $45   | 1 year   | `org.loikmon.mobile.premium.yearly`      | `loikmon_premium` / `yearly`    |

If you use different ids in the stores, update them with
`PATCH /api/v1/admin/plans/:code` (admin token). Store prices are set in each
console; the backend prices are for display on the web.

### Apple App Store (iOS)

1. App Store Connect → **Agreements**: accept the Paid Apps agreement, add banking and tax.
2. Your app → **Subscriptions** → create a subscription group (e.g. *Loikmon Premium*) with the four auto-renewable products above (durations 1/3/6/12 months), prices, localisations and review screenshot.
3. App → **App Information**:
   - copy the numeric **Apple ID** → `APPLE_APP_APPLE_ID`;
   - **App Store Server Notifications** → Version 2, production *and* sandbox URL: `https://api.loikmon.org/api/v1/webhooks/apple`.
4. **Users and Access → Integrations → In-App Purchase** → generate a key → `APPLE_KEY_ID`, `APPLE_ISSUER_ID`, and the `.p8` contents → `APPLE_PRIVATE_KEY` (one line, `\n` for newlines). This lets the backend ask Apple for the live status (grace period, billing retry, refunds).
5. `APPLE_BUNDLE_ID=com.loikmon.mobile`. Keep `APPLE_ALLOW_SANDBOX=true`: App Review and TestFlight purchase in the sandbox.
6. Create **Sandbox testers** (Users and Access → Sandbox) to test on devices.

The app sets `appAccountToken` = the Loikmon user id, and every transaction and
notification is signature-verified against Apple's root certificates
(`packages/backend/certs/apple`).

### Google Play (Android)

1. Play Console → **Monetize → Products → Subscriptions** → create `loikmon_premium` with four **auto-renewing base plans**: `monthly` (1 month), `quarterly` (3 months), `semiannual` (6 months), `yearly` (1 year). Activate them.
2. Google Cloud console (any project): create a **service account**, create a JSON key.
3. Play Console → **Users and permissions** → invite the service account email with *View financial data* and *Manage orders and subscriptions* for the app. Put the JSON (raw or base64) in `GOOGLE_SERVICE_ACCOUNT_JSON`; set `GOOGLE_PLAY_PACKAGE_NAME=com.loikmon.mobile`.
4. **Real-time developer notifications** (Pub/Sub):
   - create topic `play-rtdn`; grant `google-play-developer-notifications@system.gserviceaccount.com` the *Pub/Sub Publisher* role on it;
   - create a **push** subscription to `https://api.loikmon.org/api/v1/webhooks/google` with **authentication enabled**: choose a service account (→ `GOOGLE_PUBSUB_SERVICE_ACCOUNT`) and audience `https://api.loikmon.org/api/v1/webhooks/google` (→ `GOOGLE_PUBSUB_AUDIENCE`);
   - Play Console → **Monetization setup** → set the topic `projects/<project>/topics/play-rtdn` → *Send test notification* (the backend logs `store notification handled`, type `TEST`).
5. Add **license testers** (Play Console → Settings → License testing) and publish to an internal testing track to test purchases.

The app sets `obfuscatedAccountId` = the Loikmon user id. The backend verifies
every token with the Play Developer API and acknowledges new purchases.

### Web

There is no native payment gateway on the web. The web app shows the plans and
the account's status and links to the store listings (`APP_STORE_URL`,
`PLAY_STORE_URL`); a subscription bought in either app unlocks the web too.
Admins can also grant complimentary access (`POST /api/v1/admin/users/:id/grants`).

## 5. Operations & debugging

| Task | Command |
|------|---------|
| Follow logs | `docker compose -f docker-compose.prod.yml logs -f backend` |
| Find one request | every error response contains `request_id`; `docker compose ... logs backend \| grep <request_id>` |
| Verbose logs | set `LOG_LEVEL=debug` in `.env.production`, `up -d backend` |
| Readiness | `curl https://api.loikmon.org/health/ready` |
| Re-sync subscriptions now | `docker compose ... exec backend node dist/cli/reconcile.js` |
| Store event audit log | `GET /api/v1/admin/subscription-events` (admin) or table `subscription_events` |
| MySQL shell | `docker compose ... exec mysql mysql -uroot -p loikmon` |
| MinIO console | `ssh -L 9001:127.0.0.1:9001 user@vps`, open http://localhost:9001 |

### Common problems

| Symptom | Cause / fix |
|---------|-------------|
| `STORE_NOT_CONFIGURED` (503) on purchase | Apple or Google variables missing — check `/health/ready` → `integrations`. |
| iOS `PURCHASE_INVALID … INVALID_ENVIRONMENT` | Sandbox purchase with `APPLE_ALLOW_SANDBOX=false`, or `APPLE_APP_APPLE_ID` missing for production. |
| iOS `PURCHASE_INVALID … VERIFICATION_FAILURE` | Wrong `APPLE_BUNDLE_ID`, or the JWS was altered. |
| `PURCHASE_ALREADY_LINKED` (409) | The store account's subscription belongs to another Loikmon account (anti-sharing). Sign in with that account, or grant access manually. |
| Google `STORE_UNAVAILABLE` (502) | Service account lacks Play Console permissions (can take up to 24h to propagate) or Google outage; the app retries. |
| Play webhook `WEBHOOK_UNAUTHORIZED` | Push subscription audience/service account differ from `GOOGLE_PUBSUB_AUDIENCE` / `GOOGLE_PUBSUB_SERVICE_ACCOUNT`. |
| Book opens with 403 from `storage.` | `MINIO_PUBLIC_URL` must equal `https://STORAGE_DOMAIN` (signatures include the host); check the server clock. |
| Browser CORS error loading EPUB/PDF | `MINIO_API_CORS_ALLOW_ORIGIN` is derived from `APP_DOMAIN` + `EXTRA_CORS_ORIGINS`. |
| Auth works but emails never arrive | `SMTP_*` wrong; without SMTP the links are written to the backend log. |

## 6. Backups & restore

- **MySQL**: `db-backup` writes `./backups/mysql/loikmon-YYYYMMDD-HHMMSS.sql.gz` daily, kept `BACKUP_RETENTION_DAYS`. Copy them off the server (e.g. Hostinger snapshot, `rclone`, `rsync`).
- **MinIO data** (volume `loikmon_minio-data`):
  ```bash
  docker run --rm -v loikmon_minio-data:/data -v "$PWD/backups":/backup alpine \
    tar czf /backup/minio-$(date +%Y%m%d).tar.gz -C /data .
  ```
- **Restore MySQL**:
  ```bash
  gunzip -c backups/mysql/loikmon-XXXX.sql.gz | \
    docker compose --env-file .env.production -f docker-compose.prod.yml exec -T mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" loikmon'
  ```
