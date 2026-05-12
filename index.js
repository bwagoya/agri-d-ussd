require('dotenv').config()
const express = require('express')
const ussdRoutes = require('./routes/ussdRoutes')

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

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})