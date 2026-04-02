const { PrismaClient } = require('@prisma/client')

// Single instance reused across the app — same pattern as a Mongoose connection
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
})

module.exports = prisma
