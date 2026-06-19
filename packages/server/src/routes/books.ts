import { Router } from 'express'
import { proxyGet, proxyPost } from '../middleware/upstream.js'

const router = Router()

router.get('/fetchbooks',        (req, res) => proxyGet(req, res, 'fetchbooks'))
router.get('/fetchotherbooks',   (req, res) => proxyGet(req, res, 'fetchotherbooks'))
router.get('/getitem',           (req, res) => proxyGet(req, res, 'getitem'))
router.get('/getBookChapters',   (req, res) => proxyGet(req, res, 'getBookChapters'))
router.get('/relatedbooks',      (req, res) => proxyGet(req, res, 'relatedbooks'))
router.get('/relatedmagazines',  (req, res) => proxyGet(req, res, 'relatedmagazines'))
router.get('/getbookviewsrates', (req, res) => proxyGet(req, res, 'getbookviewsrates'))
router.post('/ratebook',             (req, res) => proxyPost(req, res, 'ratebook'))
router.post('/purchasebook',         (req, res) => proxyPost(req, res, 'purchasebook'))
router.post('/update_total_views',   (req, res) => proxyPost(req, res, 'update_total_views'))
router.post('/reportbook',           (req, res) => proxyPost(req, res, 'reportbook'))
router.post('/subscribeBookCoupon',  (req, res) => proxyPost(req, res, 'subscribeBookCoupon'))

export default router
