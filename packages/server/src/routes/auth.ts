import { Router } from 'express'
import { proxyPost } from '../middleware/upstream.js'

const router = Router()

router.post('/loginapp',        (req, res) => proxyPost(req, res, 'loginapp'))
router.post('/createaccount',   (req, res) => proxyPost(req, res, 'createaccount'))
router.post('/resetpassword',   (req, res) => proxyPost(req, res, 'resetpassword'))
router.post('/resendVerificationMail', (req, res) => proxyPost(req, res, 'resendVerificationMail'))
router.post('/updateUserProfile', (req, res) => proxyPost(req, res, 'updateUserProfile'))
router.post('/deletemyaccount', (req, res) => proxyPost(req, res, 'deletemyaccount'))
router.post('/storefcmtoken',   (req, res) => proxyPost(req, res, 'storefcmtoken'))

export default router
