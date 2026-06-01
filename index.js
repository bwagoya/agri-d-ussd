require('dotenv').config()
const express = require('express')
const cron = require('node-cron')
const ussdRoutes = require('./routes/ussdRoutes')
const { cleanExpiredSessions } = require('./services/sessionService')

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Skip ngrok browser warning
app.use((req, res, next) => {
  res.setHeader('ngrok-skip-browser-warning', 'true')
  next()
})

// Routes
app.use('/ussd', ussdRoutes)

// Base route
app.get('/', (req, res) => {
  res.send('Agri-D Ledger USSD Server is running')
})

// Clean expired sessions every 10 minutes
cron.schedule('*/10 * * * *', async () => {
  console.log('Cleaning expired sessions...')
  await cleanExpiredSessions()
})

// Self-ping to prevent spin down
setInterval(async () => {
  try {
    await fetch('https://agri-d-ussd.onrender.com')
    console.log('Self-ping successful')
  } catch (error) {
    console.log('Self-ping failed:', error.message)
  }
}, 14 * 60 * 1000) // every 4 minutes

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})