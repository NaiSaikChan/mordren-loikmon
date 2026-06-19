import { Router } from 'express'
import { proxyGet, proxyPost } from '../middleware/upstream.js'

const router = Router()

router.get('/fetchcoins',                  (req, res) => proxyGet(req, res, 'fetchcoins'))
router.get('/getusercoins',                (req, res) => proxyGet(req, res, 'getusercoins'))
router.get('/loadcoins',                   (req, res) => proxyGet(req, res, 'loadcoins'))
router.get('/fetchuserpurchases',          (req, res) => proxyGet(req, res, 'fetchuserpurchases'))
router.get('/fetchuserpurchasedbooks',     (req, res) => proxyGet(req, res, 'fetchuserpurchasedbooks'))
router.get('/fetchuserpurchasedarticles',  (req, res) => proxyGet(req, res, 'fetchuserpurchasedarticles'))
router.get('/fetchuserpendingpurchases',   (req, res) => proxyGet(req, res, 'fetchuserpendingpurchases'))
router.get('/fetch_user_purchases',        (req, res) => proxyGet(req, res, 'fetch_user_purchases'))
router.get('/fetch_purchases_album',       (req, res) => proxyGet(req, res, 'fetch_purchases_album'))
router.get('/loadbanks',                   (req, res) => proxyGet(req, res, 'loadbanks'))
router.get('/pendingBankPaymentsApp',      (req, res) => proxyGet(req, res, 'pendingBankPaymentsApp'))
router.post('/proofofpayment',            (req, res) => proxyPost(req, res, 'proofofpayment'))
router.post('/record_payment',            (req, res) => proxyPost(req, res, 'record_payment'))
router.post('/subscribeCoupon',           (req, res) => proxyPost(req, res, 'subscribeCoupon'))
router.post('/approvebook',               (req, res) => proxyPost(req, res, 'approvebook'))
router.post('/deleteproofrequest',        (req, res) => proxyPost(req, res, 'deleteproofrequest'))
router.post('/approveBankPaymentsApp',    (req, res) => proxyPost(req, res, 'approveBankPaymentsApp'))
router.post('/deleteBankPaymentsApp',     (req, res) => proxyPost(req, res, 'deleteBankPaymentsApp'))

export default router
