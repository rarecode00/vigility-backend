/**
 * Seed script — run with: npm run seed
 * Uses Prisma so it reads exactly like Mongoose seeding.
 */
require('dotenv').config()
const bcrypt = require('bcryptjs')
const prisma = require('./db')

const USERS = [
  { username: 'alice',   password: 'password123', age: 25, gender: 'Female' },
  { username: 'bob',     password: 'password123', age: 34, gender: 'Male'   },
  { username: 'charlie', password: 'password123', age: 42, gender: 'Male'   },
  { username: 'diana',   password: 'password123', age: 17, gender: 'Female' },
  { username: 'eve',     password: 'password123', age: 55, gender: 'Female' },
  { username: 'frank',   password: 'password123', age: 28, gender: 'Other'  },
  { username: 'grace',   password: 'password123', age: 31, gender: 'Female' },
  { username: 'henry',   password: 'password123', age: 45, gender: 'Male'   },
  { username: 'iris',    password: 'password123', age: 16, gender: 'Female' },
  { username: 'jack',    password: 'password123', age: 62, gender: 'Male'   },
]

const FEATURE_WEIGHTS = {
  date_filter:      30,
  gender_filter:    20,
  age_filter:       18,
  bar_chart_zoom:   15,
  line_chart_hover: 10,
  export_data:       5,
  refresh_data:      2,
}

function buildWeightedPool() {
  const pool = []
  for (const [feat, w] of Object.entries(FEATURE_WEIGHTS))
    for (let i = 0; i < w; i++) pool.push(feat)
  return pool
}

function randomDate(daysBack = 90) {
  const ms = Math.floor(Math.random() * daysBack * 86400 * 1000)
  return new Date(Date.now() - ms)
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

async function seed() {
  console.log('🌱 Starting seed...\n')

  // Wipe existing data — like mongoose deleteMany({})
  await prisma.featureClick.deleteMany({})
  await prisma.user.deleteMany({})
  console.log('  ✓ Cleared existing data')

  // Create users — like mongoose User.create([...])
  const createdUsers = []
  for (const u of USERS) {
    const hashed = await bcrypt.hash(u.password, 10)
    const user = await prisma.user.create({
      data: { username: u.username, password: hashed, age: u.age, gender: u.gender },
    })
    createdUsers.push(user)
    console.log(`  ✓ User: ${user.username} (id=${user.id}, age=${user.age}, gender=${user.gender})`)
  }

  // Create 300 click events — like mongoose FeatureClick.insertMany([...])
  const features = buildWeightedPool()
  const clickData = Array.from({ length: 300 }, () => ({
    userId:      pick(createdUsers).id,
    featureName: pick(features),
    timestamp:   randomDate(90),
  }))

  await prisma.featureClick.createMany({ data: clickData })

  console.log(`\n✅ Seeded ${createdUsers.length} users and ${clickData.length} feature-click events.`)
  console.log('\nTest credentials:')
  console.log('  alice   / password123   — age 25, Female')
  console.log('  bob     / password123   — age 34, Male')
  console.log('  charlie / password123   — age 42, Male')
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
