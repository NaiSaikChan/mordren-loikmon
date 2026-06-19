import { Router } from 'express'
import { proxyGet, proxyPost } from '../middleware/upstream.js'

const router = Router()

router.get('/loadreviews',       (req, res) => proxyGet(req, res, 'loadreviews'))
router.get('/loadrecentreviews', (req, res) => proxyGet(req, res, 'loadrecentreviews'))
router.get('/loaduserreview',    (req, res) => proxyGet(req, res, 'loaduserreview'))
router.get('/loadreplies',       (req, res) => proxyGet(req, res, 'loadreplies'))
router.post('/submitreview',     (req, res) => proxyPost(req, res, 'submitreview'))
router.post('/editreview',       (req, res) => proxyPost(req, res, 'editreview'))
router.post('/deletereview',     (req, res) => proxyPost(req, res, 'deletereview'))
router.post('/replycomment',     (req, res) => proxyPost(req, res, 'replycomment'))
router.post('/editreply',        (req, res) => proxyPost(req, res, 'editreply'))
router.post('/deletereply',      (req, res) => proxyPost(req, res, 'deletereply'))
router.post('/reportcomment',    (req, res) => proxyPost(req, res, 'reportcomment'))

export default router
