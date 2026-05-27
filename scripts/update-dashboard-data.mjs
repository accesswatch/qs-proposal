import fs from 'node:fs'
import path from 'node:path'

const token = process.env.GITHUB_TOKEN
const repository = process.env.DASHBOARD_REPOSITORY || 'accesswatch/qs-proposal'
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

  for (const issue of open) {
    const labels = issue.labels.map(l => typeof l === 'string' ? l : l.name).filter(Boolean)
    const impactLabel = labels.find(l => l.startsWith('impact:'))
    const impact = impactLabel ? impactLabel.replace('impact:', '') : 'moderate'
    weightedOpen += impactWeights[impact] || 2

    const ruleLabel = labels.find(l => l.startsWith('rule:')) || extractRuleFromTitle(issue.title)
    const rule = ruleLabel.replace('rule:', '')
    topViolationsMap.set(rule, (topViolationsMap.get(rule) || 0) + 1)

    const siteLabel = labels.find(l => l.startsWith('site:'))
    const site = siteLabel ? siteLabel.replace('site:', '') : 'unknown-site'
    if (!sitesMap.has(site)) sitesMap.set(site, {site, critical: 0, serious: 0, moderate: 0, minor: 0})
    const siteRow = sitesMap.get(site)
    siteRow[impact] = (siteRow[impact] || 0) + 1
  }

  const healthScore = Math.max(0, 100 - weightedOpen)
  const mttrDays = computeMttrDays(closed, now)
  const highImpactOpen = open.filter(i => hasImpact(i, 'critical') || hasImpact(i, 'serious')).length

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
      regressionRate: 0,
      mttrDays
    },
    trend90d: buildWeeklyTrend(issues, now),
    topViolations,
    siteScorecard
  }
}

function computeMttrDays(closed, now) {
  if (closed.length === 0) return 0
  const days = closed
    .filter(i => i.closed_at && i.created_at)
    .map(i => (new Date(i.closed_at) - new Date(i.created_at)) / (1000 * 60 * 60 * 24))
  if (days.length === 0) return 0
  return Number((days.reduce((a, b) => a + b, 0) / days.length).toFixed(1))
}

function hasImpact(issue, impact) {
  const labels = issue.labels.map(l => typeof l === 'string' ? l : l.name).filter(Boolean)
  return labels.includes(`impact:${impact}`)
}

function extractRuleFromTitle(title) {
  const match = title.match(/rule[:\s]+([a-z0-9-]+)/i)
  return `rule:${match ? match[1].toLowerCase() : 'unknown'}`
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
