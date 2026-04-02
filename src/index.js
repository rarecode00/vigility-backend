require('dotenv').config()
const express = require('express')
const cors = require('cors')
const prisma = require('./db')

const authRoutes = require('./routes/auth')
const trackRoutes = require('./routes/track')
const analyticsRoutes = require('./routes/analytics')

const app = express()
const PORT = process.env.PORT || 5000

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL,
].filter(Boolean)

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (Postman, curl, mobile)
    if (!origin) return callback(null, true)
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true)
    return callback(new Error(`CORS blocked: ${origin}`))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

// Handle preflight for all routes
app.options('*', cors())

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
