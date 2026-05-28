import fs from 'node:fs'
import path from 'node:path'

const token = process.env.GITHUB_TOKEN
const repository = process.env.DASHBOARD_REPOSITORY || 'accesswatch/qs-proposal'
const defaultSite = process.env.DASHBOARD_DEFAULT_SITE || 'quickstart.arizona.edu'
if (!token) throw new Error('GITHUB_TOKEN is required')

const [owner, repo] = repository.split('/')
const issues = await fetchAllIssues(owner, repo, token)

const root = path.resolve('.')
const dataDir = path.join(root, 'dashboard', 'data')
const historyDir = path.join(dataDir, 'history')
fs.mkdirSync(historyDir, {recursive: true})

const latestPath = path.join(dataDir, 'latest.json')
const previousMetrics = fs.existsSync(latestPath)
  ? JSON.parse(fs.readFileSync(latestPath, 'utf8'))
  : null
const metrics = buildMetrics(issues, previousMetrics)
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

function buildMetrics(issues, previousMetrics = null) {
  const now = new Date()
  const open = issues.filter(i => i.state === 'open')
  const closed = issues.filter(i => i.state === 'closed')
  const ignoredLabelNames = new Set([
    'a11y:ignore',
    'a11y:accepted-risk',
    'wontfix',
    'duplicate',
    'invalid',
    'false-positive',
    'a11y:false-positive'
  ])

  const impactWeights = {critical: 8, serious: 5, moderate: 2, minor: 1}
  let weightedOpen = 0
  const topViolationsMap = new Map()
  const sitesMap = new Map()
  const recurringPatternsMap = new Map()
  const ruleImpactMap = new Map()
  const siteRiskMap = new Map()
  const actionPatternMap = new Map()
  const openIssueDetails = []
  const ignoredIssues = []
  const ignoredByReasonMap = new Map()
  const duplicateSignatureMap = new Map()
  const processedSignatures = new Set()
  let ignoredOpenCount = 0
  let duplicatesCollapsed = 0
  let highImpactOpen = 0

  for (const issue of open) {
    const labels = issue.labels.map(l => typeof l === 'string' ? l : l.name).filter(Boolean)
    const normalizedLabels = labels.map(label => label.toLowerCase())
    const ignoreReasons = normalizedLabels.filter(label => ignoredLabelNames.has(label))
    if (ignoreReasons.length > 0) {
      ignoredOpenCount += 1
      ignoredIssues.push({
        title: issue.title,
        url: issue.html_url,
        reasons: ignoreReasons
      })
      for (const reason of ignoreReasons) {
        ignoredByReasonMap.set(reason, (ignoredByReasonMap.get(reason) || 0) + 1)
      }
      continue
    }

    const rule = extractRule(issue.title, labels)
    const impact = inferImpact(labels, rule)
    const site = inferSite(issue.title, labels, defaultSite)
    const urlPath = extractPath(issue.title)
    const pathPattern = normalizePathPattern(urlPath)
    const ownerTeam = inferOwnerTeam(pathPattern)
    const likelyFixArea = inferLikelyFixArea(pathPattern, rule)
    const actionPatternKey = `${site}||${rule}||${likelyFixArea}`
    if (!actionPatternMap.has(actionPatternKey)) {
      actionPatternMap.set(actionPatternKey, {
        site,
        ruleId: rule,
        ownerTeam,
        likelyFixArea,
        totalOccurrences: 0,
        affectedPaths: new Set(),
        maxImpact: impact,
        sampleIssueUrl: issue.html_url
      })
    }
    const actionPatternRow = actionPatternMap.get(actionPatternKey)
    actionPatternRow.totalOccurrences += 1
    actionPatternRow.affectedPaths.add(pathPattern)
    actionPatternRow.maxImpact = higherImpact(actionPatternRow.maxImpact, impact)
    const signature = `${site}||${rule}||${pathPattern}||${impact}`

    if (processedSignatures.has(signature)) {
      duplicatesCollapsed += 1
      if (!duplicateSignatureMap.has(signature)) {
        duplicateSignatureMap.set(signature, {
          signature,
          site,
          ruleId: rule,
          pathPattern,
          impact,
          duplicateCount: 0
        })
      }
      duplicateSignatureMap.get(signature).duplicateCount += 1
      continue
    }
    processedSignatures.add(signature)

    weightedOpen += impactWeights[impact] || 2
    if (impact === 'critical' || impact === 'serious') highImpactOpen += 1

    topViolationsMap.set(rule, (topViolationsMap.get(rule) || 0) + 1)

    if (!sitesMap.has(site)) {
      sitesMap.set(site, {site, critical: 0, serious: 0, moderate: 0, minor: 0})
    }
    const siteRow = sitesMap.get(site)
    siteRow[impact] = (siteRow[impact] || 0) + 1

    const patternKey = `${site}||${rule}||${pathPattern}`
    if (!recurringPatternsMap.has(patternKey)) {
      recurringPatternsMap.set(patternKey, {
        site,
        ruleId: rule,
        pathPattern,
        count: 0,
        impact,
        sampleIssueUrl: issue.html_url,
        sampleIssueTitle: issue.title
      })
    }
    recurringPatternsMap.get(patternKey).count += 1

    if (!ruleImpactMap.has(rule)) {
      ruleImpactMap.set(rule, {ruleId: rule, critical: 0, serious: 0, moderate: 0, minor: 0, total: 0})
    }
    const ruleImpactRow = ruleImpactMap.get(rule)
    ruleImpactRow[impact] += 1
    ruleImpactRow.total += 1

    if (!siteRiskMap.has(site)) {
      siteRiskMap.set(site, {site, highImpact: 0, total: 0, weightedScore: 0})
    }
    const siteRiskRow = siteRiskMap.get(site)
    if (impact === 'critical' || impact === 'serious') siteRiskRow.highImpact += 1
    siteRiskRow.total += 1
    siteRiskRow.weightedScore += impactWeights[impact] || 2

    openIssueDetails.push({
      title: issue.title,
      url: issue.html_url,
      createdAt: issue.created_at,
      ruleId: rule,
      impact,
      site,
      path: urlPath
    })
  }

  const effectiveOpenCount = processedSignatures.size
  const healthScore = Math.max(0, 100 - weightedOpen)
  const mttrDays = computeMttrDays(closed)
  const trend90d = buildWeeklyTrend(issues, now)
  const latestPeriod = trend90d[trend90d.length - 1]
  const regressionRate = effectiveOpenCount === 0
    ? 0
    : (latestPeriod ? Number((latestPeriod.openIssues / effectiveOpenCount).toFixed(3)) : 0)

  const topViolations = [...topViolationsMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([ruleId, count]) => ({ruleId, count}))

  const siteScorecard = [...sitesMap.values()].sort((a, b) => (b.critical + b.serious) - (a.critical + a.serious))
  const recurringIssuePatterns = [...recurringPatternsMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)
  const actionablePatterns = [...actionPatternMap.values()]
    .map(pattern => ({
      ...pattern,
      affectedPaths: [...pattern.affectedPaths].sort(),
      affectedPathCount: pattern.affectedPaths.size
    }))
    .sort((a, b) => b.totalOccurrences - a.totalOccurrences)
  const ruleImpact = [...ruleImpactMap.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
  const siteRisk = [...siteRiskMap.values()]
    .sort((a, b) => b.weightedScore - a.weightedScore)
  const recentOpenIssues = openIssueDetails
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 25)
  const executiveBrief = buildExecutiveBrief(effectiveOpenCount, topViolations, siteRisk, recurringIssuePatterns)
  const actionCenter = buildActionCenter({
    owner,
    repo,
    actionablePatterns,
    ruleImpact,
    siteRisk
  })
  const staleActionableIssues = openIssueDetails.filter(issue => (now - new Date(issue.createdAt)) > 14 * 24 * 60 * 60 * 1000).length
  const qualityControls = {
    rawOpenIssues: open.length,
    ignoredOpenIssues: ignoredOpenCount,
    actionableOpenIssues: open.length - ignoredOpenCount,
    dedupedOpenIssues: effectiveOpenCount,
    duplicateEntriesIgnored: duplicatesCollapsed,
    ignoredByReason: [...ignoredByReasonMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([reason, count]) => ({reason, count})),
    ignoredIssuesSample: ignoredIssues.slice(0, 10),
    duplicateSignatureSample: [...duplicateSignatureMap.values()]
      .sort((a, b) => b.duplicateCount - a.duplicateCount)
      .slice(0, 10),
    staleActionableIssues
  }
  const remediationProgress = buildRemediationProgress(previousMetrics, {
    healthScore,
    effectiveOpenCount,
    highImpactOpen
  })
  const validationWins = buildValidationWins({
    open,
    closed,
    openRuleMap: ruleImpactMap,
    ignoredLabelNames,
    now
  })
  const scanOperations = buildScanOperations({
    owner,
    repo,
    qualityControls,
    topViolations
  })

  return {
    generatedAt: now.toISOString(),
    summary: {
      healthScore,
      openIssues: effectiveOpenCount,
      highImpactOpen,
      regressionRate,
      mttrDays
    },
    remediationProgress,
    validationWins,
    qualityControls,
    scanOperations,
    trend90d,
    topViolations,
    siteScorecard,
    executiveBrief,
    actionCenter,
    drilldowns: {
      recurringIssuePatterns,
      ruleImpact,
      siteRisk,
      recentOpenIssues
    }
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

function extractPath(title) {
  const pathMatch = title.match(/\son\s(\/[^\s]*)$/i)
  if (pathMatch) return pathMatch[1]
  return '/'
}

function normalizePathPattern(urlPath) {
  return urlPath
    .split('/')
    .map(segment => {
      if (!segment) return ''
      if (/^\d+$/.test(segment)) return '{id}'
      if (/^[0-9a-f]{8,}$/i.test(segment)) return '{id}'
      if (/^[0-9a-f-]{16,}$/i.test(segment)) return '{id}'
      return segment
    })
    .join('/') || '/'
}

function buildExecutiveBrief(openIssueCount, topViolations, siteRisk, recurringIssuePatterns) {
  const primaryRule = topViolations[0] || null
  const topSite = siteRisk[0] || null
  const topPattern = recurringIssuePatterns[0] || null

  const primaryDriver = primaryRule ? {
    ruleId: primaryRule.ruleId,
    openFindings: primaryRule.count,
    shareOpenPercent: Number(((primaryRule.count / Math.max(openIssueCount, 1)) * 100).toFixed(1))
  } : null

  return {
    primaryDriver,
    highestRiskSite: topSite,
    topRecurringPattern: topPattern,
    focusStatement: buildFocusStatement(primaryRule, topSite, topPattern)
  }
}

function buildFocusStatement(primaryRule, topSite, topPattern) {
  if (!primaryRule || !topSite || !topPattern) {
    return 'Not enough data yet for a risk concentration statement.'
  }
  return `Prioritize ${primaryRule.ruleId} on ${topSite.site}; most repeated pattern is ${topPattern.pathPattern} (${topPattern.count} open findings).`
}

function buildRemediationProgress(previousMetrics, current) {
  if (!previousMetrics || !previousMetrics.summary) {
    return {
      hasBaseline: false,
      summary: 'No prior snapshot available yet for trend comparison.'
    }
  }

  const previousOpen = Number(previousMetrics.summary.openIssues || 0)
  const previousHighImpact = Number(previousMetrics.summary.highImpactOpen || 0)
  const previousHealth = Number(previousMetrics.summary.healthScore || 0)
  const openDelta = current.effectiveOpenCount - previousOpen
  const highImpactDelta = current.highImpactOpen - previousHighImpact
  const healthDelta = current.healthScore - previousHealth

  return {
    hasBaseline: true,
    previousGeneratedAt: previousMetrics.generatedAt || null,
    openDelta,
    highImpactDelta,
    healthDelta,
    summary: `Open issues ${formatDelta(openDelta)}, high-impact ${formatDelta(highImpactDelta)}, health score ${formatDelta(healthDelta)} since previous snapshot.`
  }
}

function formatDelta(delta) {
  if (delta > 0) return `+${delta}`
  return `${delta}`
}

function buildValidationWins({open, closed, openRuleMap, ignoredLabelNames, now}) {
  const openRuleSet = new Set([...openRuleMap.keys()])
  const closedRuleMap = new Map()
  let closedFindingsLast30d = 0
  let ignoredClosedCount = 0
  for (const issue of closed) {
    const labels = issue.labels.map(l => typeof l === 'string' ? l : l.name).filter(Boolean)
    const normalizedLabels = labels.map(label => label.toLowerCase())
    const ignored = normalizedLabels.some(label => ignoredLabelNames.has(label))
    if (ignored) {
      ignoredClosedCount += 1
      continue
    }

    const rule = extractRule(issue.title, labels)
    closedRuleMap.set(rule, (closedRuleMap.get(rule) || 0) + 1)
    if (issue.closed_at) {
      const daysSinceClosed = (now - new Date(issue.closed_at)) / (1000 * 60 * 60 * 24)
      if (daysSinceClosed <= 30) closedFindingsLast30d += 1
    }
  }

  const trackedRuleSet = new Set([...openRuleSet, ...closedRuleMap.keys()])
  const resolvedRules = [...closedRuleMap.entries()]
    .filter(([ruleId]) => !openRuleSet.has(ruleId))
    .sort((a, b) => b[1] - a[1])
    .map(([ruleId, closedCount]) => ({ruleId, closedCount}))
  const rulesCurrentlyClean = resolvedRules.length
  const trackedRuleCount = trackedRuleSet.size

  return {
    trackedRuleCount,
    rulesCurrentlyClean,
    cleanRuleSharePercent: trackedRuleCount > 0 ? Number(((rulesCurrentlyClean / trackedRuleCount) * 100).toFixed(1)) : 0,
    closedFindingsLast30d,
    closedFindingsTotal: closed.length - ignoredClosedCount,
    resolvedRulesTop: resolvedRules.slice(0, 10)
  }
}

function buildActionCenter({owner, repo, actionablePatterns, ruleImpact, siteRisk}) {
  const prioritizedActions = actionablePatterns
    .map(pattern => {
      const priority = scorePriority({impact: pattern.maxImpact, count: pattern.totalOccurrences})
      const actionTitle = `Fix ${pattern.ruleId} in ${pattern.likelyFixArea}`
      const recommendedFix = fixRecommendation(pattern.ruleId)
      return {
        priority,
        actionTitle,
        ruleId: pattern.ruleId,
        impact: pattern.maxImpact,
        openFindings: pattern.totalOccurrences,
        potentialReduction: pattern.totalOccurrences,
        ownerTeam: pattern.ownerTeam,
        likelyFixArea: pattern.likelyFixArea,
        affectedPathCount: pattern.affectedPathCount,
        affectedPaths: pattern.affectedPaths.slice(0, 10),
        sampleIssueUrl: pattern.sampleIssueUrl,
        issueDraftUrl: buildIssueDraftUrl(owner, repo, {
          title: actionTitle,
          ruleId: pattern.ruleId,
          ownerTeam: pattern.ownerTeam,
          likelyFixArea: pattern.likelyFixArea,
          openFindings: pattern.totalOccurrences,
          affectedPathCount: pattern.affectedPathCount,
          affectedPaths: pattern.affectedPaths,
          recommendedFix
        }),
        recommendedFix
      }
    })
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 8)

  const hotspotOwners = buildOwnerHotspots(actionablePatterns)
  const fixPlaybooks = ruleImpact.slice(0, 6).map(rule => ({
    ruleId: rule.ruleId,
    totalOpen: rule.total,
    recommendedFix: fixRecommendation(rule.ruleId),
    docsHint: `Focus on templates/components producing ${rule.ruleId}.`
  }))

  const magicOpportunities = []
  if (prioritizedActions.length > 0) {
    magicOpportunities.push(`Target top ${Math.min(3, prioritizedActions.length)} actions to potentially remove ${prioritizedActions.slice(0, 3).reduce((sum, item) => sum + item.potentialReduction, 0)} open findings.`)
  }
  if (siteRisk[0]) {
    magicOpportunities.push(`Run a template-level fix sprint on ${siteRisk[0].site}; it currently carries the highest weighted risk.`)
  }
  if (hotspotOwners[0]) {
    magicOpportunities.push(`Assign first remediation wave to ${hotspotOwners[0].ownerTeam} based on hotspot concentration.`)
  }

  return {
    prioritizedActions,
    hotspotOwners,
    fixPlaybooks,
    magicOpportunities
  }
}

function scorePriority(pattern) {
  const impactBase = pattern.impact === 'critical' ? 100 : pattern.impact === 'serious' ? 70 : pattern.impact === 'moderate' ? 40 : 20
  return impactBase + (pattern.count * 5)
}

function inferOwnerTeam(pathPattern) {
  if (pathPattern.startsWith('/create-content/editor-toolbar')) return 'Content editing UX team'
  if (pathPattern.startsWith('/create-content/events')) return 'Events content team'
  if (pathPattern.startsWith('/create-content')) return 'CMS authoring/template team'
  if (pathPattern === '/') return 'Core web platform team'
  if (pathPattern.startsWith('/support') || pathPattern.startsWith('/help')) return 'Support content team'
  return 'Web platform team'
}

function inferLikelyFixArea(pathPattern, ruleId) {
  if (ruleId.startsWith('landmark-')) return 'Global page layout template (header/main/footer landmarks)'
  if (ruleId === 'heading-order' || ruleId === 'page-has-heading-one') return 'Page title and heading component templates'
  if (ruleId === 'list') return 'Rich text rendering and list markup templates'
  if (pathPattern.startsWith('/create-content')) return 'Drupal content type templates for authoring pages'
  if (pathPattern === '/') return 'Homepage shell template and shared includes'
  return `Template/components behind ${pathPattern}`
}

function fixRecommendation(ruleId) {
  const map = {
    'landmark-contentinfo-is-top-level': 'Keep one footer landmark at top level; remove nested contentinfo wrappers.',
    'landmark-no-duplicate-contentinfo': 'Ensure only one contentinfo/footer landmark per page.',
    'landmark-unique': 'Add unique aria-label/aria-labelledby to repeated landmarks.',
    'list': 'Refactor list markup so ul/ol contain only li children.',
    'heading-order': 'Normalize heading hierarchy to increment one level at a time.',
    'page-has-heading-one': 'Guarantee a single descriptive H1 for each page template.',
    'landmark-one-main': 'Wrap core content in one main landmark.',
    'region': 'Wrap significant content blocks in semantic landmarks.'
  }
  return map[ruleId] || 'Apply rule-specific remediation from Axe documentation and re-scan.'
}

function buildIssueDraftUrl(owner, repo, action) {
  const title = `[A11y Pattern] ${action.ruleId} in ${action.likelyFixArea} (${action.openFindings} occurrences)`
  const affectedPathLines = (action.affectedPaths || []).slice(0, 25).map(item => `  - ${item}`)
  const body = [
    `Suggested action: ${action.title}`,
    '',
    `- Rule: ${action.ruleId}`,
    `- Open occurrences represented: ${action.openFindings}`,
    `- Affected paths represented: ${action.affectedPathCount || (action.affectedPaths || []).length}`,
    `- Suggested owner: ${action.ownerTeam}`,
    `- Likely fix area: ${action.likelyFixArea}`,
    `- Recommendation: ${action.recommendedFix}`,
    '',
    'Affected paths (sample):',
    ...(affectedPathLines.length > 0 ? affectedPathLines : ['  - (none)']),
    '',
    'Definition of done:',
    '1. Implement template/component fix.',
    '2. Re-scan affected paths and verify occurrence count decreases.',
    '3. Close matching issues when verified.'
  ].join('\n')
  return `https://github.com/${owner}/${repo}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`
}

function buildOwnerHotspots(actionablePatterns) {
  const ownerMap = new Map()
  for (const pattern of actionablePatterns) {
    const ownerTeam = pattern.ownerTeam || inferOwnerTeam(pattern.pathPattern || '/')
    if (!ownerMap.has(ownerTeam)) {
      ownerMap.set(ownerTeam, {
        ownerTeam,
        representedFindings: 0,
        affectedPatterns: 0
      })
    }
    const row = ownerMap.get(ownerTeam)
    row.representedFindings += pattern.totalOccurrences || pattern.count || 0
    row.affectedPatterns += 1
  }
  return [...ownerMap.values()].sort((a, b) => b.representedFindings - a.representedFindings)
}

function higherImpact(currentImpact, nextImpact) {
  return impactRank(nextImpact) > impactRank(currentImpact) ? nextImpact : currentImpact
}

function impactRank(impact) {
  if (impact === 'critical') return 4
  if (impact === 'serious') return 3
  if (impact === 'moderate') return 2
  if (impact === 'minor') return 1
  return 0
}

function buildScanOperations({owner, repo, qualityControls, topViolations}) {
  const rawOpen = Number(qualityControls.rawOpenIssues || 0)
  const dedupedOpen = Number(qualityControls.dedupedOpenIssues || 0)
  const duplicateIgnored = Number(qualityControls.duplicateEntriesIgnored || 0)
  const noiseReductionPercent = rawOpen > 0
    ? Number(((duplicateIgnored / rawOpen) * 100).toFixed(1))
    : 0
  const completeRuntimeMinutes = Math.max(20, Math.ceil((rawOpen || 100) / 18))
  const deltaRuntimeMinutes = Math.max(8, Math.ceil(completeRuntimeMinutes * 0.45))
  const topRuleIds = topViolations.slice(0, 5).map(item => item.ruleId)

  const profiles = [
    {
      profileId: 'complete-baseline',
      label: 'Complete Baseline Scan',
      triggerType: 'Admin manual run',
      scanMode: 'complete',
      ruleProfile: 'all-rules',
      behavior: 'Runs full crawl/rule coverage and refreshes full issue truth.',
      suggestedCadence: 'Nightly or weekly',
      estimatedRuntimeMinutes: completeRuntimeMinutes
    },
    {
      profileId: 'delta-new-issues',
      label: 'Delta (New Issues Only)',
      triggerType: 'Frontend launcher or manual',
      scanMode: 'delta',
      ruleProfile: 'focused-rules',
      behavior: 'Prioritizes new signatures and treats known signatures as persistent status, not new alerts.',
      suggestedCadence: 'On demand and hourly in active remediation windows',
      estimatedRuntimeMinutes: deltaRuntimeMinutes
    },
    {
      profileId: 'complete-fast',
      label: 'Complete Fast (Axe Only)',
      triggerType: 'Admin manual run',
      scanMode: 'complete',
      ruleProfile: 'axe-only',
      behavior: 'Runs complete signature coverage without reflow scan to shorten runtime.',
      suggestedCadence: 'Daily',
      estimatedRuntimeMinutes: Math.max(12, Math.ceil(completeRuntimeMinutes * 0.72))
    }
  ]

  const combinations = [
    {
      combination: 'Frontend: delta + focused rules',
      objective: 'Fast triage after content/template updates',
      estimatedRuntimeMinutes: deltaRuntimeMinutes,
      expectedSignal: 'New issues list + persistent count',
      estimatedNoiseReductionPercent: noiseReductionPercent
    },
    {
      combination: 'Admin manual: complete baseline',
      objective: 'Authoritative risk snapshot',
      estimatedRuntimeMinutes: completeRuntimeMinutes,
      expectedSignal: 'Full risk, trend, and scorecard updates',
      estimatedNoiseReductionPercent: 0
    },
    {
      combination: 'Admin manual: complete fast',
      objective: 'Daily regression watch with lower runtime',
      estimatedRuntimeMinutes: Math.max(12, Math.ceil(completeRuntimeMinutes * 0.72)),
      expectedSignal: 'Broad detection with lower scan cost',
      estimatedNoiseReductionPercent: Math.max(0, Number((noiseReductionPercent * 0.4).toFixed(1)))
    }
  ]

  return {
    launcher: {
      workflowPath: '.github/workflows/configurable-scan.yml',
      githubActionsUrl: `https://github.com/${owner}/${repo}/actions/workflows/configurable-scan.yml`,
      ghCliExamples: [
        `gh workflow run configurable-scan.yml -R ${owner}/${repo} -f target=quickstart -f scan_mode=delta -f rule_profile=focused-rules -f run_source=frontend -f file_issues=false`,
        `gh workflow run configurable-scan.yml -R ${owner}/${repo} -f target=quickstart -f scan_mode=complete -f rule_profile=all-rules -f run_source=admin -f file_issues=true`
      ]
    },
    profiles,
    combinations,
    proof: {
      knownSignatureCount: dedupedOpen,
      duplicateEntriesIgnored: duplicateIgnored,
      estimatedNoiseReductionPercent: noiseReductionPercent,
      sampleCandidateRulesForFocusedProfile: topRuleIds
    }
  }
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
