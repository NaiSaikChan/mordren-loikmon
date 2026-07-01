import { Router } from 'express'
import { proxyGet, proxyPost } from '../middleware/upstream.js'

const router = Router()

router.get('/fetcharticles',                   (req, res) => proxyGet(req, res, 'fetcharticles'))
router.post('/fetcharticles',                  (req, res) => proxyPost(req, res, 'fetcharticles'))
router.post('/purchasearticle',                (req, res) => proxyPost(req, res, 'purchasearticle'))
router.post('/update_article_total_views',     (req, res) => proxyPost(req, res, 'update_article_total_views'))

export default router
