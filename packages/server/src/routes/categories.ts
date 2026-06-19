import { Router } from 'express'
import { proxyGet } from '../middleware/upstream.js'

const router = Router()

router.get('/fetchcategories',      (req, res) => proxyGet(req, res, 'fetchcategories'))
router.get('/fetch_categories',     (req, res) => proxyGet(req, res, 'fetch_categories'))
router.get('/fetch_app_categories', (req, res) => proxyGet(req, res, 'fetch_app_categories'))
router.get('/fetch_sub_categories', (req, res) => proxyGet(req, res, 'fetch_sub_categories'))

export default router
