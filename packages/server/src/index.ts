import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import { createProxyMiddleware } from 'http-proxy-middleware'

import authRouter from './routes/auth.js'
import booksRouter from './routes/books.js'
import articlesRouter from './routes/articles.js'
import authorsRouter from './routes/authors.js'
import categoriesRouter from './routes/categories.js'
import mediaRouter from './routes/media.js'
import reviewsRouter from './routes/reviews.js'
import purchasesRouter from './routes/purchases.js'
import miscRouter from './routes/misc.js'
import { errorHandler } from './middleware/errorHandler.js'

const app = express()
const PORT = Number(process.env.PORT ?? 4000)
const LOIKMON_API = process.env.LOIKMON_API_BASE ?? 'https://loikmon.org/webapis'
const CORS_ORIGINS = (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:4173')
  .split(',')
  .map((s) => s.trim())

// ── Middleware ────────────────────────────────────
app.use(morgan('dev'))
app.use(cors({ origin: CORS_ORIGINS, credentials: true }))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// ── Health check ──────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', upstream: LOIKMON_API })
})

// ── BFF routes (typed) ────────────────────────────
app.use('/api/auth', authRouter)
app.use('/api/books', booksRouter)
app.use('/api/articles', articlesRouter)
app.use('/api/authors', authorsRouter)
app.use('/api/categories', categoriesRouter)
app.use('/api/media', mediaRouter)
app.use('/api/reviews', reviewsRouter)
app.use('/api/purchases', purchasesRouter)
app.use('/api/misc', miscRouter)

// ── Catch-all transparent proxy (fallback) ────────
app.use(
  '/proxy',
  createProxyMiddleware({
    target: LOIKMON_API,
    changeOrigin: true,
    pathRewrite: { '^/proxy': '' },
  }),
)

// ── Error handler ─────────────────────────────────
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`\n🚀 Loikmon BFF running on http://localhost:${PORT}`)
  console.log(`   Upstream → ${LOIKMON_API}\n`)
})

export default app
