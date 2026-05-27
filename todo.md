# Todo

## Definitive Execution Order (Both Paths Covered)

### 1) Foundation Setup (Week 0-1)
- [ ] Create fine-grained PAT (`GH_TOKEN`) with write access to `accesswatch/az_quickstart` (contents, issues, pull-requests, metadata) and `accesswatch/azaccess` (contents)
- [ ] Add `GH_TOKEN` as a repository secret in `accesswatch/azaccess`
- [ ] Add/confirm scanner workflow in `accesswatch/azaccess/.github/workflows/az-quickstart-scan.yml`
- [ ] Enable scanner dedup/noise controls: `cache_key`, `open_grouped_issues: true`, `include_screenshots: true`
- [ ] Confirm `skip_copilot_assignment` policy (`true` for manual triage flow, `false` if Copilot assignment desired)

### 2) Live-Site Discovery and Coverage (Week 1-3)
- [ ] Build URL inventory seed set (homepage, nav hubs, forms, search, contact, news/event detail pages)
- [ ] Import and review `sitemap.xml` URLs into `url_configs`
- [ ] Add automated discovery workflow: sitemap ingest + route export + seed crawl + dedupe/canonicalization
- [ ] Publish versioned `url_configs` artifact for scanner jobs
- [ ] Add top analytics pages (top 100-200 monthly) to URL inventory
- [ ] Add template coverage set so each major Quickstart component appears at least once
- [ ] Maintain curated critical-journey URL supplement (forms/search/authenticated/high-risk flows)
- [ ] Add `excludeSelectors` for known third-party noise per URL in `url_configs`
- [ ] Run first full live scan and review filed issues in `accesswatch/az_quickstart`
- [ ] Run second full live scan to verify deduplication (no duplicate re-filing)
- [ ] Configure discovery quality gates (coverage ratio, freshness, churn alerts, scanability failures)
- [ ] Pilot discovery + scan workflow against GLOW (`community-access/glow`, `https://www.letitglow.app`)

### 3) PR/Check-In CI Path (Axe-core First, Non-Blocking Start) (Week 2-5)
- [ ] Add PR accessibility workflow to `az-digital/az_quickstart` targeting preview/build output with Axe-core
- [ ] Select primary CI target pattern: preview URL, local clone in CI, or private staged clone with auth
- [ ] Stage A: set non-blocking mode (`continue-on-error: true`) and post PR summary comments
- [ ] Define triage labels and ownership (`a11y-reviewed`, `a11y-exception`, severity + component labels)
- [ ] Stage B: keep non-blocking but require triage on serious/critical findings
- [ ] Stage C: enable targeted blocking for agreed high-impact rules only
- [ ] Document temporary exception process with expiry date and owner

### 4) Cadence and Operations (Ongoing)
- [ ] PR open/update: run Axe-core CI checks (non-blocking initially)
- [ ] Push to `main`: run smoke live scan on key URLs
- [ ] Nightly: run full live-site inventory scan
- [ ] Weekly: run triage review (new issues, regressions, repeat patterns, exceptions)
- [ ] Weekly: run URL discovery QA review (coverage, churn, failed URLs)
- [ ] Weekly: split triage by ownership lane (content editor vs site builder/dev)
- [ ] Monthly: publish leadership summary with trends, risk, and throughput
- [ ] Monthly: include Campus Web Services + Arizona Digital governance review and escalations
- [ ] Monthly: run executive recheck review of persistent/reopened high-impact issues and exception aging
- [ ] Quarterly: review and recalibrate blocking rule set, exception SLAs, and dashboard KPIs

### 5) Dashboard Program (Amazing but Practical) (Week 4+)
- [ ] Phase A: Executive scorecard (health score, trendline, top violations, high-impact backlog)
- [ ] Phase B: Engineering drilldowns (component heat map, regression radar, exception debt tracker)
- [ ] Phase C: Training insights (team learning feed, accepted fix patterns, before/after examples)
- [ ] Phase D: Automation (weekly JSON snapshots, monthly reporting export)
- [ ] Publish dashboard via GitHub Pages from historical JSON snapshots and GitHub API aggregates
- [ ] Finalize dashboard data schema columns (issue lifecycle, recheck status, ownership, traffic, fix outcomes)

### 6) Learning + Upstream Improvement Loop (Week 6+)
- [ ] Build/maintain component pattern library from confirmed findings and accepted fixes
- [ ] Publish role-based training digest from top recurring issues (content and component tracks)
- [ ] Track Copilot fix acceptance rate (if using Copilot assignment)
- [ ] Contribute high-value component fixes upstream to `az-digital/az_quickstart`
- [ ] Re-scan post-merge to verify regressions do not return

### 7) U of A Process and Support Alignment
- [ ] Add role ownership labels (`owner:content-editor`, `owner:site-builder`, `owner:dev`) to issue workflow
- [ ] Map accessibility issue types to Quickstart workshop tracks (Content Editor vs Site Builder)
- [ ] Document ServiceNow escalation flow for platform blockers and approved exceptions (`https://web.arizona.edu/help`)
