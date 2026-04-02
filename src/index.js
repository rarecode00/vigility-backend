require('dotenv').config()
const express = require('express')
const cors = require('cors')
const prisma = require('./db')

const authRoutes      = require('./routes/auth')
const trackRoutes     = require('./routes/track')
const analyticsRoutes = require('./routes/analytics')

const app  = express()
const PORT = process.env.PORT || 5000

app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }))
app.use(express.json())

app.use('/api', authRoutes)
app.use('/api', trackRoutes)
app.use('/api', analyticsRoutes)

app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date() }))

// Verify DB connection on startup — like mongoose.connect()
prisma.$connect()
  .then(() => {
    console.log('✅ Connected to PostgreSQL via Prisma')
    app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`))
  })
  .catch(err => {
    console.error('❌ Database connection failed:', err)
    process.exit(1)
  })

module.exports = app
