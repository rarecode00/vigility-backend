const express = require('express')
const prisma = require('../db')
const { authenticate } = require('../middleware/auth')

const router = express.Router()

/**
 * Builds a Prisma `where` object from query params.
 * This is the Prisma equivalent of building a Mongo query filter object.
 *
 * e.g. { timestamp: { gte: ..., lte: ... }, user: { gender: 'Male', age: { lt: 18 } } }
 */
function buildWhere({ start_date, end_date, age_group, gender }) {
  const where = {}

  // Date range filter — like { timestamp: { $gte: start, $lte: end } } in Mongo
  if (start_date || end_date) {
    where.timestamp = {}
    if (start_date) where.timestamp.gte = new Date(start_date)
    if (end_date)   where.timestamp.lte = new Date(end_date + 'T23:59:59Z')
  }

  // User demographic filters — nested relation filter, like populate + match in Mongo
  if ((gender && gender !== 'All') || (age_group && age_group !== 'All')) {
    where.user = {}

    if (gender && gender !== 'All') {
      where.user.gender = gender
    }

    if (age_group && age_group !== 'All') {
      if (age_group === '<18')   where.user.age = { lt: 18 }
      if (age_group === '18-40') where.user.age = { gte: 18, lte: 40 }
      if (age_group === '>40')   where.user.age = { gt: 40 }
    }
  }

  return where
}

// GET /api/analytics
router.get('/analytics', authenticate, async (req, res) => {
  const { start_date, end_date, age_group, gender, feature } = req.query

  try {
    const baseWhere = buildWhere({ start_date, end_date, age_group, gender })

    // ── Bar chart: total clicks grouped by feature name ────────────────────────
    // prisma.featureClick.groupBy — like Mongo's aggregate + $group
    const barRaw = await prisma.featureClick.groupBy({
      by: ['featureName'],
      where: baseWhere,
      _count: { featureName: true },
      orderBy: { _count: { featureName: 'desc' } },
    })

    const bar_chart = barRaw.map(r => ({
      feature_name:  r.featureName,
      total_clicks:  r._count.featureName,
    }))

    // ── Line chart: daily click count, optionally scoped to one feature ────────
    const lineWhere = { ...baseWhere }
    if (feature) lineWhere.featureName = feature

    // Prisma doesn't support DATE() grouping natively, so we fetch and group in JS.
    // The dataset is small enough (filtered by date range) that this is fine.
    const lineRaw = await prisma.featureClick.findMany({
      where: lineWhere,
      select: { timestamp: true },
      orderBy: { timestamp: 'asc' },
    })

    // Group by calendar date — like a $dateToString + $group in Mongo aggregation
    const dateCounts = {}
    for (const { timestamp } of lineRaw) {
      const date = timestamp.toISOString().split('T')[0] // "YYYY-MM-DD"
      dateCounts[date] = (dateCounts[date] || 0) + 1
    }
    const line_chart = Object.entries(dateCounts).map(([date, click_count]) => ({ date, click_count }))

    // ── Summary stats ──────────────────────────────────────────────────────────
    // prisma.featureClick.count — like mongoose FeatureClick.countDocuments(filter)
    const total_clicks = await prisma.featureClick.count({ where: baseWhere })

    // Count distinct users — prisma groupBy trick
    const uniqueUserGroups = await prisma.featureClick.groupBy({
      by: ['userId'],
      where: baseWhere,
    })
    const unique_users = uniqueUserGroups.length

    return res.json({
      bar_chart,
      line_chart,
      summary: {
        total_clicks,
        unique_users,
        active_features: bar_chart.length,
      },
    })
  } catch (err) {
    console.error('Analytics error:', err)
    return res.status(500).json({ error: 'Internal server error.' })
  }
})

module.exports = router
