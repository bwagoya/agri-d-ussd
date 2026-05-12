const express = require('express')
const router = express.Router()
const ussdController = require('../controllers/ussdController')

router.post('/callback', ussdController.handleUssd)
router.get('/callback', (req, res) => {
  res.send('USSD callback URL is active')
})
module.exports = router