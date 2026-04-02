const express = require('express')
const prisma = require('../db')
const { authenticate } = require('../middleware/auth')

const router = express.Router()

// POST /api/track
router.post('/track', authenticate, async (req, res) => {
  const { feature_name } = req.body

  if (!feature_name?.trim())
    return res.status(400).json({ error: 'feature_name is required.' })

  try {
    // prisma.featureClick.create — like mongoose FeatureClick.create({...})
    const click = await prisma.featureClick.create({
      data: {
        userId: req.user.id,
        featureName: feature_name.trim(),
      },
    })

    return res.status(201).json(click)
  } catch (err) {
    console.error('Track error:', err)
    return res.status(500).json({ error: 'Internal server error.' })
  }
})

module.exports = router
