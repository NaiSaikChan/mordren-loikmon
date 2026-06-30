import { Router } from 'express'
import { proxyGet, proxyPost } from '../middleware/upstream.js'

const router = Router()

router.get('/fetchauthors',         (req, res) => proxyGet(req, res, 'fetchauthors'))
router.post('/fetchauthors',        (req, res) => proxyPost(req, res, 'fetchauthors'))
router.get('/getauthor',            (req, res) => proxyGet(req, res, 'getauthor'))
router.post('/get_author_data',     (req, res) => proxyPost(req, res, 'get_author_data'))
router.get('/get_author_data',      (req, res) => proxyGet(req, res, 'get_author_data'))
router.get('/fetchauthorcategories',(req, res) => proxyGet(req, res, 'fetchauthorcategories'))
router.get('/fetch_author_inbox',   (req, res) => proxyGet(req, res, 'fetch_author_inbox'))
router.get('/artistdashboard',      (req, res) => proxyGet(req, res, 'artistdashboard'))
router.get('/artistfilterdashboard',(req, res) => proxyGet(req, res, 'artistfilterdashboard'))
router.post('/follow_unfollow_author', (req, res) => proxyPost(req, res, 'follow_unfollow_author'))
router.post('/followunfollow',      (req, res) => proxyPost(req, res, 'followunfollow'))
router.post('/editArtistApp',       (req, res) => proxyPost(req, res, 'editArtistApp'))

export default router
