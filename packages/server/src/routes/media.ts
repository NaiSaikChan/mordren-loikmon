import { Router } from 'express'
import { proxyGet, proxyPost } from '../middleware/upstream.js'

const router = Router()

router.get('/fetch_media',          (req, res) => proxyGet(req, res, 'fetch_media'))
router.get('/getTrendingMedia',     (req, res) => proxyGet(req, res, 'getTrendingMedia'))
router.get('/fetch_livestreams',    (req, res) => proxyGet(req, res, 'fetch_livestreams'))
router.get('/fetch_artists_media',  (req, res) => proxyGet(req, res, 'fetch_artists_media'))
router.get('/fetch_categories_media',(req, res) => proxyGet(req, res, 'fetch_categories_media'))
router.get('/fetch_genre_media',    (req, res) => proxyGet(req, res, 'fetch_genre_media'))
router.get('/fetch_albums',         (req, res) => proxyGet(req, res, 'fetch_albums'))
router.get('/fetch_all_albums',     (req, res) => proxyGet(req, res, 'fetch_all_albums'))
router.get('/fetch_album_media',    (req, res) => proxyGet(req, res, 'fetch_album_media'))
router.get('/fetch_moods',          (req, res) => proxyGet(req, res, 'fetch_moods'))
router.post('/likeunlikemedia',          (req, res) => proxyPost(req, res, 'likeunlikemedia'))
router.post('/update_media_total_views', (req, res) => proxyPost(req, res, 'update_media_total_views'))
router.post('/purchase_media',           (req, res) => proxyPost(req, res, 'purchase_media'))
router.post('/tip_media',                (req, res) => proxyPost(req, res, 'tip_media'))
router.post('/createMediaApp',           (req, res) => proxyPost(req, res, 'createMediaApp'))
router.post('/editMediaApp',             (req, res) => proxyPost(req, res, 'editMediaApp'))
router.post('/purchase_album',           (req, res) => proxyPost(req, res, 'purchase_album'))
router.post('/createAlbumApp',           (req, res) => proxyPost(req, res, 'createAlbumApp'))
router.post('/editAlbumApp',             (req, res) => proxyPost(req, res, 'editAlbumApp'))

export default router
