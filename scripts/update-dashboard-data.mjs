import fs from 'node:fs'
import path from 'node:path'

const token = process.env.GITHUB_TOKEN
const repository = process.env.DASHBOARD_REPOSITORY || 'accesswatch/qs-proposal'
const defaultSite = process.env.DASHBOARD_DEFAULT_SITE || 'quickstart.arizona.edu'
if (!token) throw new Error('GITHUB_TOKEN is required')

const [owner, repo] = repository.split('/')
const issues = await fetchAllIssues(owner, repo, token)
const metrics = buildMetrics(issues)

const root = path.resolve('.')
const dataDir = path.join(root, 'dashboard', 'data')
const historyDir = path.join(dataDir, 'history')
fs.mkdirSync(historyDir, {recursive: true})

const latestPath = path.join(dataDir, 'latest.json')
fs.writeFileSync(latestPath, JSON.stringify(metrics, null, 2))

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const snapshotPath = path.join(historyDir, `${stamp}.json`)
fs.writeFileSync(snapshotPath, JSON.stringify(metrics, null, 2))

console.log(`Wrote ${latestPath}`)
console.log(`Wrote ${snapshotPath}`)

async function fetchAllIssues(owner, repo, token) {
  const collected = []
  let page = 1
  while (true) {
    const url = `https://api.github.com/repos/${owner}/${repo}/issues?state=all&per_page=100&page=${page}`
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'qs-proposal-dashboard-refresh'
      }
    })
    if (!res.ok) throw new Error(`GitHub API failed (${res.status})`)
    const chunk = await res.json()
    const issuesOnly = chunk.filter(item => !item.pull_request)
    collected.push(...issuesOnly)
    if (chunk.length < 100) break
    page += 1
  }
  return collected
}

function buildMetrics(issues) {
  const now = new Date()
  const open = issues.filter(i => i.state === 'open')
  const closed = issues.filter(i => i.state === 'closed')

  const impactWeights = {critical: 8, serious: 5, moderate: 2, minor: 1}
  let weightedOpen = 0
  const topViolationsMap = new Map()
  const sitesMap = new Map()
  let highImpactOpen = 0

  for (const issue of open) {
    const labels = issue.labels.map(l => typeof l === 'string' ? l : l.name).filter(Boolean)
    const rule = extractRule(issue.title, labels)
    const impact = inferImpact(labels, rule)
    const site = inferSite(issue.title, labels, defaultSite)

    weightedOpen += impactWeights[impact] || 2
    if (impact === 'critical' || impact === 'serious') highImpactOpen += 1

    topViolationsMap.set(rule, (topViolationsMap.get(rule) || 0) + 1)

    if (!sitesMap.has(site)) {
      sitesMap.set(site, {site, critical: 0, serious: 0, moderate: 0, minor: 0})
    }
    const siteRow = sitesMap.get(site)
    siteRow[impact] = (siteRow[impact] || 0) + 1
  }

  const healthScore = Math.max(0, 100 - weightedOpen)
  const mttrDays = computeMttrDays(closed)
  const trend90d = buildWeeklyTrend(issues, now)
  const latestPeriod = trend90d[trend90d.length - 1]
  const regressionRate = latestPeriod ? Number((latestPeriod.openIssues / Math.max(open.length, 1)).toFixed(3)) : 0

  const topViolations = [...topViolationsMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([ruleId, count]) => ({ruleId, count}))

  const siteScorecard = [...sitesMap.values()].sort((a, b) => (b.critical + b.serious) - (a.critical + a.serious))

  return {
    generatedAt: now.toISOString(),
    summary: {
      healthScore,
      openIssues: open.length,
      highImpactOpen,
      regressionRate,
      mttrDays
    },
    trend90d,
    topViolations,
    siteScorecard
  }
}

function computeMttrDays(closed) {
  if (closed.length === 0) return 0
  const days = closed
    .filter(i => i.closed_at && i.created_at)
    .map(i => (new Date(i.closed_at) - new Date(i.created_at)) / (1000 * 60 * 60 * 24))
  if (days.length === 0) return 0
  return Number((days.reduce((a, b) => a + b, 0) / days.length).toFixed(1))
}

function extractRule(title, labels) {
  const axeRuleLabel = labels.find(label => label.toLowerCase().startsWith('axe rule:'))
  if (axeRuleLabel) return axeRuleLabel.split(':').slice(1).join(':').trim().toLowerCase()

  const explicitRuleLabel = labels.find(label => label.toLowerCase().startsWith('rule:'))
  if (explicitRuleLabel) return explicitRuleLabel.split(':').slice(1).join(':').trim().toLowerCase()

  return extractRuleFromTitle(title).replace('rule:', '')
}

function extractRuleFromTitle(title) {
  const match = title.match(/rule[:\s]+([a-z0-9-]+)/i)
  return `rule:${match ? match[1].toLowerCase() : 'unknown'}`
}

function inferSite(title, labels, defaultSite) {
  const siteLabel = labels.find(label => label.toLowerCase().startsWith('site:'))
  if (siteLabel) return siteLabel.split(':').slice(1).join(':').trim()

  // accessibility-scanner titles often end with "on /path"
  const pathMatch = title.match(/\son\s(\/[^\s]*)$/i)
  if (pathMatch && defaultSite) return defaultSite

  return defaultSite || 'unknown-site'
}

function inferImpact(labels, rule) {
  const impactLabel = labels.find(label => label.startsWith('impact:'))
  if (impactLabel) {
    const labeledImpact = impactLabel.replace('impact:', '')
    if (['critical', 'serious', 'moderate', 'minor'].includes(labeledImpact)) return labeledImpact
  }

  const criticalRules = new Set(['color-contrast', 'label', 'aria-allowed-attr', 'aria-required-attr'])
  const seriousRules = new Set([
    'heading-order',
    'landmark-unique',
    'landmark-contentinfo-is-top-level',
    'landmark-no-duplicate-contentinfo',
    'list',
    'link-name',
  ])

  if (criticalRules.has(rule)) return 'critical'
  if (seriousRules.has(rule)) return 'serious'
  return 'moderate'
}

function buildWeeklyTrend(issues, now) {
  const trend = []
  for (let i = 7; i >= 0; i--) {
    const end = new Date(now)
    end.setDate(now.getDate() - i * 7)
    const start = new Date(end)
    start.setDate(end.getDate() - 7)
    const opened = issues.filter(issue => {
      const created = new Date(issue.created_at)
      return created >= start && created < end
    }).length
    const closed = issues.filter(issue => {
      if (!issue.closed_at) return false
      const closedAt = new Date(issue.closed_at)
      return closedAt >= start && closedAt < end
    }).length
    trend.push({period: `W${8 - i}`, openIssues: opened, closedIssues: closed})
  }
  return trend
}
