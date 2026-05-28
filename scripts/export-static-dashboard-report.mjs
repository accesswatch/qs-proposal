import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve('.')
const dataPath = path.join(root, 'dashboard', 'data', 'latest.json')
const outDir = path.join(root, 'dashboard', 'static')
const outPath = path.join(outDir, 'latest-report.html')

if (!fs.existsSync(dataPath)) {
  throw new Error(`Missing dashboard data at ${dataPath}`)
}

const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'))
fs.mkdirSync(outDir, {recursive: true})
fs.writeFileSync(outPath, buildHtml(data))
console.log(`Wrote ${outPath}`)

function buildHtml(data) {
  const summary = data.summary || {}
  const topViolations = (data.topViolations || []).slice(0, 10)
  const actions = (data.actionCenter && data.actionCenter.prioritizedActions) || []
  const guardrails = data.qualityControls || {}
  const wins = data.validationWins || {}
  const generated = new Date(data.generatedAt || Date.now()).toLocaleString()
  const remediationSummary = (data.remediationProgress && data.remediationProgress.summary) || 'No baseline snapshot yet.'

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Accessibility Dashboard Snapshot</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif; margin: 18px; color: #1f2328; }
    h1, h2 { margin-bottom: 8px; }
    .grid { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); margin-bottom: 12px; }
    .card { border: 1px solid #d0d7de; border-radius: 8px; padding: 10px; }
    .label { font-size: 12px; color: #57606a; margin-bottom: 6px; }
    .value { font-size: 24px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
    th, td { border: 1px solid #d8dee4; padding: 8px; text-align: left; font-size: 14px; }
    th { background: #f6f8fa; }
    .note { font-size: 13px; color: #57606a; }
  </style>
</head>
<body>
  <h1>Quickstart Accessibility Snapshot</h1>
  <p class="note">Generated ${escapeHtml(generated)} · Static email-ready report from dashboard/data/latest.json</p>

  <h2>Executive Summary</h2>
  <div class="grid">
    ${card('Health Score', summary.healthScore)}
    ${card('Open Issues (deduped)', summary.openIssues)}
    ${card('High-Impact Open', summary.highImpactOpen)}
    ${card('Regression Rate', `${Number((summary.regressionRate || 0) * 100).toFixed(1)}%`)}
    ${card('MTTR (days)', summary.mttrDays)}
  </div>

  <h2>Remediation Tracking</h2>
  <p>${escapeHtml(remediationSummary)}</p>

  <h2>Validation Wins</h2>
  <div class="grid">
    ${card('Rules currently clean', wins.rulesCurrentlyClean ?? 0)}
    ${card('Tracked rules', wins.trackedRuleCount ?? 0)}
    ${card('Clean rule share', `${wins.cleanRuleSharePercent ?? 0}%`)}
    ${card('Closed findings (30d)', wins.closedFindingsLast30d ?? 0)}
  </div>

  <h2>Top Violations</h2>
  <table>
    <thead><tr><th>Rule</th><th>Open Findings</th></tr></thead>
    <tbody>
      ${topViolations.map(v => `<tr><td>${escapeHtml(v.ruleId)}</td><td>${escapeHtml(v.count)}</td></tr>`).join('') || '<tr><td colspan="2">No data</td></tr>'}
    </tbody>
  </table>

  <h2>Top Action Recommendations</h2>
  <table>
    <thead><tr><th>Action</th><th>Owner</th><th>Likely Fix Area</th><th>Potential Reduction</th></tr></thead>
    <tbody>
      ${(actions.slice(0, 8)).map(a => `<tr><td>${escapeHtml(a.actionTitle)}</td><td>${escapeHtml(a.ownerTeam)}</td><td>${escapeHtml(a.likelyFixArea)}</td><td>${escapeHtml(a.potentialReduction)}</td></tr>`).join('') || '<tr><td colspan="4">No action recommendations</td></tr>'}
    </tbody>
  </table>

  <h2>Dedup/Ignore Guardrails</h2>
  <table>
    <thead><tr><th>Metric</th><th>Value</th></tr></thead>
    <tbody>
      <tr><td>Raw Open Issues</td><td>${escapeHtml(guardrails.rawOpenIssues ?? 0)}</td></tr>
      <tr><td>Ignored Open Issues</td><td>${escapeHtml(guardrails.ignoredOpenIssues ?? 0)}</td></tr>
      <tr><td>Deduped Open Issues</td><td>${escapeHtml(guardrails.dedupedOpenIssues ?? 0)}</td></tr>
      <tr><td>Duplicate Entries Ignored</td><td>${escapeHtml(guardrails.duplicateEntriesIgnored ?? 0)}</td></tr>
    </tbody>
  </table>

  <p class="note">This file is intended for email sharing and executive review without requiring live dashboard scripts.</p>
</body>
</html>`
}

function card(label, value) {
  return `<article class="card"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div></article>`
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
