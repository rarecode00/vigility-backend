const express = require('express')
const bcrypt = require('bcryptjs')
const prisma = require('../db')
const { signToken } = require('../middleware/auth')

const router = express.Router()

// POST /api/register
router.post('/register', async (req, res) => {
  const { username, password, age, gender } = req.body

  if (!username?.trim() || !password || !age || !gender)
    return res.status(400).json({ error: 'All fields (username, password, age, gender) are required.' })
  if (!['Male', 'Female', 'Other'].includes(gender))
    return res.status(400).json({ error: 'Gender must be Male, Female, or Other.' })
  if (!Number.isInteger(age) || age < 1 || age > 120)
    return res.status(400).json({ error: 'Age must be a number between 1 and 120.' })

  try {
    const hashed = await bcrypt.hash(password, 10)

    // prisma.user.create — just like mongoose User.create({...})
    const user = await prisma.user.create({
      data: { username: username.trim(), password: hashed, age, gender },
      select: { id: true, username: true, age: true, gender: true },
    })

    const token = signToken({ id: user.id, username: user.username, age: user.age, gender: user.gender })
    return res.status(201).json({ token, user })
  } catch (err) {
    if (err.code === 'P2002') // Prisma unique constraint violation — same idea as Mongo duplicate key
      return res.status(409).json({ error: 'Username already taken.' })
    console.error('Register error:', err)
    return res.status(500).json({ error: 'Internal server error.' })
  }
})

// POST /api/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body

  if (!username?.trim() || !password)
    return res.status(400).json({ error: 'Username and password are required.' })

  try {
    // prisma.user.findUnique — like mongoose User.findOne({ username })
    const user = await prisma.user.findUnique({
      where: { username: username.trim() },
    })

    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ error: 'Invalid username or password.' })

    const token = signToken({ id: user.id, username: user.username, age: user.age, gender: user.gender })
    return res.json({
      token,
      user: { id: user.id, username: user.username, age: user.age, gender: user.gender },
    })
  } catch (err) {
    console.error('Login error:', err)
    return res.status(500).json({ error: 'Internal server error.' })
  }
})

module.exports = router
