const express = require('express');
const router = express.Router();
const { shorten, analytics, list, deactivate } = require('../controllers/urlController');

router.get('/urls', list);
router.post('/shorten', shorten);
router.get('/analytics/:shortCode', analytics);
router.delete('/urls/:shortCode', deactivate);

module.exports = router;
