import { Router } from 'express'
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

export default router
