import { Router } from 'express'
import axios from 'axios'
import { proxyGet, proxyPost } from '../middleware/upstream.js'

const router = Router()

router.get('/initapp',           (req, res) => proxyGet(req, res, 'initapp'))
router.get('/overview',          (req, res) => proxyGet(req, res, 'overview'))
router.get('/search',            (req, res) => proxyGet(req, res, 'search'))
router.get('/fetchfaqs',         (req, res) => proxyGet(req, res, 'fetchfaqs'))
router.get('/fetchcontactus',    (req, res) => proxyGet(req, res, 'fetchcontactus'))
router.get('/loadcountries',     (req, res) => proxyGet(req, res, 'loadcountries'))
router.get('/fetch_inbox',       (req, res) => proxyGet(req, res, 'fetch_inbox'))
router.get('/fetch_collections', (req, res) => proxyGet(req, res, 'fetch_collections'))
router.get('/fetchSingleCollection', (req, res) => proxyGet(req, res, 'fetchSingleCollection'))
router.get('/fetchleagues',      (req, res) => proxyGet(req, res, 'fetchleagues'))
router.get('/terms',             (req, res) => proxyGet(req, res, 'terms'))
router.get('/privacy',           (req, res) => proxyGet(req, res, 'privacy'))
router.get('/aboutus',           (req, res) => proxyGet(req, res, 'aboutus'))
router.get('/donate',            (req, res) => proxyGet(req, res, 'donate'))
router.post('/deeplink',         (req, res) => proxyPost(req, res, 'deeplink'))

// Stream PDF files through BFF to avoid browser CORS/HEAD issues when loading in VPdfViewer.
router.get('/pdf-proxy', async (req, res) => {
	const rawUrl = String(req.query.url ?? '')
	if (!rawUrl) {
		res.status(400).json({ error: 'Missing required query parameter: url' })
		return
	}

	let parsed: URL
	try {
		parsed = new URL(rawUrl)
	} catch {
		res.status(400).json({ error: 'Invalid url' })
		return
	}

	// Restrict proxy usage to the known upstream host for safety.
	if (!/^https?:$/.test(parsed.protocol) || parsed.hostname !== 'loikmon.org') {
		res.status(400).json({ error: 'Unsupported url host' })
		return
	}

	try {
		const upstream = await axios.get<ArrayBuffer>(parsed.toString(), {
			responseType: 'arraybuffer',
			headers: {
				Accept: 'application/pdf,*/*',
			},
		})

		const contentType = String(upstream.headers['content-type'] ?? 'application/pdf')
		const contentLength = upstream.headers['content-length']

		res.setHeader('Content-Type', contentType)
		if (contentLength) {
			res.setHeader('Content-Length', String(contentLength))
		}
		res.setHeader('Cache-Control', 'public, max-age=3600')

		res.send(Buffer.from(upstream.data))
	} catch (error: unknown) {
		const e = error as { response?: { status: number; data?: unknown }; message?: string }
		res.status(e.response?.status ?? 502).json(
			e.response?.data ?? { error: e.message ?? 'Failed to fetch PDF' },
		)
	}
})

export default router
