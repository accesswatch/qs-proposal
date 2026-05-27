# Arizona Quickstart Accessibility Scanner — Strategic Implementation Plan

**Prepared for:** University of Arizona Leadership  
**Prepared by:** Jeff Bishop (accesswatch), Digital Accessibility  
**Date:** May 27, 2026  
**Version:** 1.9  
**Status:** Draft for Review

---

## Executive Summary

This plan recommends a **definitive dual-track accessibility strategy** for Arizona Quickstart:

1. **Axe-core in CI (pre-merge):** Run Axe-core checks on pull requests against rendered preview/build outputs to catch regressions before code lands.
2. **`github/accessibility-scanner@v3` on live URLs (post-merge + scheduled):** Continuously scan real rendered pages in production/staging, file and deduplicate issues, and track trends over time.

This is the highest-confidence model for a Drupal-based platform: **CI prevents new defects; live scanning catches real-world/content/integration defects that source-only checks miss.**

Both tracks require a **rendered web target** (preview URL, CI-hosted localhost clone, staging, or production URL). They do **not** require public production targets for every run.

The scanner implementation provides:
- Rendered-page scanning with axe-core + Playwright (Playwright opens real browser pages, executes page rendering/JS, and provides the DOM state Axe evaluates)
- Automatic issue filing, grouping, and deduplication (`cache_key`, `open_grouped_issues`)
- Optional Copilot issue assignment (not required)
- Structured outputs (`results_file`) for dashboards, KPI tracking, and training insights

**Executive outcome:** Accessibility becomes an operational system, not a one-time audit — with measurable regression prevention, prioritized remediation, and leadership-ready trend reporting.

**Execution principle:** Start non-blocking in PR CI to establish signal quality, then move to targeted blocking on high-impact Axe-core rules while nightly live scans continue in parallel.

**Dashboard plan (executive view):** Publish a GitHub Pages dashboard fed by scanner `results_file` snapshots and GitHub Issues/PR metadata, delivered in four phases:
1. **Executive scorecard:** Health score, 30/60/90-day trends, top violations, high-impact backlog.
2. **Engineering drilldowns:** Component heat map, regression radar, exception debt tracking.
3. **Training and awareness:** "What we learned" feed, accepted fix patterns, before/after examples.
4. **Operational automation:** Weekly snapshot generation plus monthly leadership reporting packets.

This dashboard is designed to answer three leadership questions every month: **Are we improving, where is risk concentrated, and what fixes are working across teams?**

**Strategic checkpoint (executive recheck):** Recheck status of previously identified high-impact issues at the executive monthly review, including reopened findings and unresolved exceptions, so "known risk" stays visible until fixed or formally accepted.

**Executive quick links (details below):**
- [Dual-track strategy and operating model](#21-dual-track-coverage-model-both-paths)
- [URL discovery automation pipeline](#automated-url-discovery-pipeline-recommended)
- [CI topology: preview vs clone vs deployed target](#ci-execution-topology-clone-vs-deployed-target)
- [Deduplication and recheck behavior](#6-deduplication-and-noise-reduction)
- [Operational cadence and executive recheck](#operational-cadence-recommended)
- [Dashboard panels and metrics](#7-dashboard-and-metrics)
- [Dashboard data columns/model](#dashboard-data-model-recommended-columns)

---

## Table of Contents

1. [Current State](#1-current-state)
2. [Strategic Goals](#2-strategic-goals)
3. [Architecture Overview](#3-architecture-overview)
4. [Test Case: Proof of Concept](#4-test-case-proof-of-concept)
5. [Implementation Phases](#5-implementation-phases)
6. [Deduplication and Noise Reduction](#6-deduplication-and-noise-reduction)
7. [Dashboard and Metrics](#7-dashboard-and-metrics)
8. [Pattern Learning Strategy](#8-pattern-learning-strategy)
9. [Resource Requirements](#9-resource-requirements)
10. [Success Metrics and KPIs](#10-success-metrics-and-kpis)
11. [Risks and Mitigations](#11-risks-and-mitigations)
12. [Appendices](#12-appendices)

---

## 1. Current State

### What Already Exists

The University already has meaningful momentum:

| Asset | Location | Purpose |
|---|---|---|
| Working scanner workflow | `accesswatch/azaccess` | Scans prototype site nightly, on push, on PR |
| Accessibility dashboard | `accesswatch/azaccess/docs/` | Published to GitHub Pages with trend history |
| CI proposal document | `accesswatch/azaccess/ACCESSIBILITY-CI-PROPOSAL.md` | Multi-tool (axe/Lighthouse/Pa11y) CI strategy |
| Quickstart fork | `accesswatch/az_quickstart` | Fork of `az-digital/az_quickstart` for experimentation |
| Axe scan reports | `accesswatch/azaccess/scripts/axe-reports/` | Historical JSON reports from past scans |
| Accessibility knowledge base | `accesswatch/azaccess` | Role-based guidance, checklists, WCAG crosswalk |

### What the Scanner Catches Today

The existing `accesswatch/azaccess` scanner runs WCAG 2.2 AA checks and already captures real findings on the prototype site. The `azaccess` scans provide a learning baseline for what types of issues a Quickstart-based site produces.

### The Gap

The actual `az_quickstart` distribution and the sites it powers are not yet in the scanner's scope. This plan closes that gap.

---

## 2. Strategic Goals

| Priority | Goal | Audience |
|---|---|---|
| P0 | Catch accessibility regressions before they reach production | Developers, QA |
| P1 | Build a traceable, assignable issue backlog for all known violations | Engineering, Product |
| P2 | Eliminate scan noise through intelligent deduplication | All |
| P3 | Surface patterns to inform component-level fixes in Quickstart itself | Arizona Digital team |
| P4 | Provide leadership with trend dashboards showing measurable improvement | Leadership, Compliance |
| P5 | Use GitHub Copilot to propose and merge code fixes, reviewed by humans | Developers |

---

## 2.1 Dual-Track Coverage Model (Both Paths)

To maximize coverage, run two complementary tracks in parallel:

1. **PR/build CI track (Axe-core-first):** Catch regressions before merge using Axe-core against PR previews or built artifacts.
2. **Live-site track (`github/accessibility-scanner@v3`):** Catch production-only and content-driven issues on real URLs over time.

**Recommendation:** Yes, Axe-core is the best primary signal on the CI side for fast, high-confidence regression detection. Keep Lighthouse/Pa11y as optional secondary lenses where needed, but do not block merges on those initially.

---

## 2.2 U of A Quickstart Business Process Alignment

Reviewing core Quickstart documentation confirms this plan should include explicit role and support alignment:

1. **Role-based operations are required:** Quickstart distinguishes Content Editor vs Site Builder/Admin responsibilities. Findings should route to the right owner type, not a generic queue.
2. **Training is part of execution, not optional:** U of A already runs Content Editor and Site Builder workshops; scanner rollout should include training adoption checkpoints.
3. **Support escalation path exists:** Campus Web Services support requests route through ServiceNow (`web.arizona.edu/help`) with standard response handling.
4. **Content workflow matters:** Many accessibility defects are content-authoring issues (alt text, heading order, descriptive links, table misuse), so remediation must include editorial governance in addition to code fixes.

### Plan adjustments based on Quickstart fundamentals

| Area | Adjustment |
|---|---|
| Triage workflow | Split ownership labels by role (`owner:content-editor`, `owner:site-builder`, `owner:dev`) |
| Weekly operations | Add role-specific triage lane: content defects to editors, component defects to dev/site builder |
| Monthly governance | Include Campus Web Services and Arizona Digital in monthly trend review + escalation queue |
| Training loop | Add required "top recurring errors" training digest sourced from dashboard trends |
| Escalation process | Route platform-level blockers and exceptions via ServiceNow request workflow |

This does not change the technical architecture; it strengthens execution by matching how U of A Quickstart teams actually work.

---

## 3. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         TRIGGER EVENTS                                       │
│  PR Opened   Merge to Main   Nightly Cron   Tugboat Preview   Manual Dispatch│
└──────────────────────┬───────────────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│              github/accessibility-scanner@v3 (GitHub Action)                 │
│                                                                              │
│  ┌─────────────────────┐   ┌──────────────────┐   ┌────────────────────────┐│
│  │  Playwright Browser │   │   axe-core WCAG  │   │  cache_key lookup      ││
│  │  Renders live URLs  │──▶│   2.2 AA Scan    │──▶│  (skip known issues)   ││
│  └─────────────────────┘   └──────────────────┘   └───────────┬────────────┘│
│                                                                │             │
│                                               New finding?     │             │
│                                                    ▼           │             │
│                                       ┌────────────────────┐  │ Known issue │
│                                       │  File GitHub Issue  │  │ → skip      │
│                                       │  with full context  │  │             │
│                                       └────────┬───────────┘  │             │
│                                                │              │             │
│                                    Has Copilot?│              │             │
│                                                ▼              │             │
│                                    ┌───────────────────────┐  │             │
│                                    │ Assign to Copilot     │  │             │
│                                    │ for fix suggestion    │  │             │
│                                    └───────────────────────┘  │             │
└──────────────────────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                    RESULTS OUTPUTS                                           │
│                                                                              │
│  GitHub Issues (labeled, assigned)   →  Issue Tracker / Sprint Board        │
│  results_file JSON                   →  Dashboard / Trend Analysis          │
│  Grouped Issues (open_grouped_issues) →  Violation-type tracking issues     │
│  Screenshots (include_screenshots)   →  Visual evidence in issues           │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Two-Repo Pattern

A critical architectural decision is to **separate the scanner infrastructure from the issue destination**:

```
accesswatch/azaccess           accesswatch/az_quickstart
(scanner lives here)           (issues filed here)
        │                              │
        │  github/accessibility-       │
        │  scanner@v3 runs,            │
        │  targets Quickstart URLs  ──▶│  GitHub Issues created
        │                              │  with WCAG violation details
        │  cache_key stored here       │  Assigned to Copilot
        │  (deduplication)             │  Labels: a11y, wcag-2.2, component name
```

This is immediately achievable — the scanner's `repository` input points to any repo the token has write access to. No Drupal install required.

---

## 4. Test Case: Proof of Concept

### Can we scan Quickstart from a different repo?

**Yes, absolutely.** This is the recommended first step.

#### How it works

The `github/accessibility-scanner@v3` action:
1. Takes a list of **URLs** to scan (not code files)
2. Files issues in whichever **repository** you specify via the `repository` input
3. The scanning workflow lives in repo A; the issues are filed in repo B

#### Test Case Configuration

Add this workflow to `accesswatch/azaccess` (already has secrets/infrastructure):

```yaml
# .github/workflows/az-quickstart-scan.yml
name: AZ Quickstart Accessibility Scan

on:
  workflow_dispatch:
  schedule:
    - cron: '0 4 * * 1'  # Monday mornings for learning reviews

jobs:
  scan_quickstart:
    runs-on: ubuntu-latest
    steps:
      - uses: github/accessibility-scanner@v3
        with:
          urls: |
            https://quickstart.arizona.edu
            https://quickstart.arizona.edu/best-practices/accessibility-guidelines
            https://quickstart.arizona.edu/create-content/editor-toolbar
            https://quickstart.arizona.edu/get-started/overview
            https://quickstart.arizona.edu/news
          repository: accesswatch/az_quickstart
          token: ${{ secrets.GH_TOKEN }}
          cache_key: az-quickstart-public-scan.json
          include_screenshots: true
          open_grouped_issues: true
          scans: '["axe", "reflow-scan"]'
```

#### What this proves

- Scanner infrastructure works with Quickstart-based URLs
- Issues land correctly in the `az_quickstart` repo
- Deduplication cache prevents noise on repeated runs
- Grouped issues reveal pattern clusters (e.g., "color-contrast affects 12 pages")
- Zero Drupal installation required

#### Expanding the URL set

Once the initial scan runs, expand to real Quickstart-powered UA sites:

```yaml
urls: |
  https://quickstart.arizona.edu
  https://medicine.arizona.edu
  https://eller.arizona.edu
  https://capla.arizona.edu
  https://science.arizona.edu
  https://drc.arizona.edu
  https://ischool.arizona.edu
  https://law.arizona.edu
```

These are public-facing Quickstart sites. Scanning them reveals which accessibility patterns are systemic across the distribution vs. site-specific content problems.

#### URL inventory strategy (important: scanner does not crawl)

The scanner checks only the URLs you provide. To get near-complete coverage, maintain a curated URL inventory using this order:

1. **Seed set:** Homepage + primary navigation + top user journeys (apply, contact, forms, search, news/event detail pages).
2. **Sitemap import:** Pull all URLs from `sitemap.xml` and filter to indexable pages.
3. **Template sampling:** Ensure each Quickstart template/component appears in at least one scanned URL.
4. **Analytics top pages:** Add the top 100-200 pages by traffic each month.
5. **Risk-based additions:** Add pages with heavy JS widgets, forms, media players, and third-party embeds.

Maintain this list in version control (`url_configs`) so coverage changes are reviewable over time.

#### Automated URL discovery pipeline (recommended)

To automate URL handoff into scanner runs, add a discovery job that builds `url_configs` before each scheduled scan:

1. Ingest Drupal sitemap URLs (`sitemap.xml` and nested sitemap indexes).
2. Pull published route/content exports from Drupal where available.
3. Crawl from approved seed URLs (home, section hubs, key journeys) to discover linked pages.
4. Merge, deduplicate, canonicalize, and filter (domain/path/query/filetype/noindex rules).
5. Add curated high-risk URLs (forms, search states, authenticated user paths, third-party embed pages).
6. Emit a versioned `url_configs` artifact for the scanner job to consume.

**Important limit:** no crawler will discover every meaningful page state automatically. Keep a curated "critical journey" supplement under source control.

**Implementation now available in this repo:** `/.github/actions/discover` (GitHub Action) with:
- sitemap ingestion (including sitemap-index recursion),
- optional Drupal route endpoint ingestion,
- optional WordPress REST ingestion (`pages` + `posts`),
- bounded seed crawl with depth/domain limits,
- scanner-ready output (`url_configs`) for `github/accessibility-scanner@v3`.

#### Discovery quality gates (what else belongs in this plan)

Treat URL discovery itself as a governed product with measurable quality:

| Gate | Target |
|---|---|
| Coverage ratio | >= 90% of top-traffic pages represented in `url_configs` |
| Freshness | Discovery artifact regenerated at least daily for production scans |
| Churn control | Unexpected URL count delta over threshold triggers review |
| Critical journey coverage | 100% of approved critical journeys represented |
| Scanability | URLs returning non-200 or blocked responses routed to triage queue |

This prevents a false sense of completeness and keeps executive reporting trustworthy.

---

## 5. Implementation Phases

### Phase 0 — Test Case (Week 1–2)
**Goal:** Prove the pipeline works. No risk. High learning.

| Task | Owner | Effort |
|---|---|---|
| Add `az-quickstart-scan.yml` workflow to `accesswatch/azaccess` | Jeff Bishop | 2 hrs |
| Create `GH_TOKEN` PAT with write access to `accesswatch/az_quickstart` | Jeff Bishop | 30 min |
| Run first scan against `quickstart.arizona.edu` pages | Automated | - |
| Review filed issues, validate groupings and deduplication | Jeff Bishop | 1 hr |
| Document baseline findings | Jeff Bishop | 2 hrs |

**Deliverable:** First set of real issues in `accesswatch/az_quickstart`. Proof of concept complete.

---

### Phase 1 — Foundation (Weeks 3–6)
**Goal:** Scan live Quickstart-powered sites systematically. Build baseline.

| Task | Owner | Effort |
|---|---|---|
| Expand URL list to 10–20 Quickstart-powered UA sites | Jeff + Arizona Digital | 1 day |
| Configure URL-specific exclusion selectors for third-party widgets | Jeff Bishop | 2 hrs |
| Set up label taxonomy in `az_quickstart` repo (wcag-level, impact, component) | Jeff Bishop | 1 hr |
| Enable `open_grouped_issues: true` for violation-type grouping | Jeff Bishop | 30 min |
| Enable `include_screenshots: true` for visual evidence in issues | Jeff Bishop | 30 min |
| Add reflow scan (mobile accessibility) to scan config | Jeff Bishop | 30 min |
| Review grouped issues and begin identifying Quickstart component patterns | Arizona Digital | Ongoing |
| Share Phase 1 findings summary with Arizona Digital team | Jeff Bishop | 1 day |

**Deliverable:** Baseline accessibility inventory for 10–20 Quickstart sites. Violation pattern report. Label taxonomy in place.

---

### Phase 2 — PR-Level Gates (Weeks 7–12)
**Goal:** Catch regressions before they merge. Start non-blocking, then graduate to targeted blocking.

This phase requires coordination with `az-digital/az_quickstart` maintainers to add a workflow to the upstream repository.

**The PR-level scanner approach for a Drupal project:**

Arizona Quickstart uses [Tugboat](https://www.tugboatqa.com/) for PR preview environments. Every PR to `az-digital/az_quickstart` automatically gets a live preview URL. The scanner can target that URL.

```yaml
# Workflow to add to az-digital/az_quickstart
name: PR Accessibility Gate
on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  scan_pr_preview:
    runs-on: ubuntu-latest
    # Wait for Tugboat to build the preview first
    steps:
      - name: Wait for Tugboat deployment
        # Use Tugboat's API or a manual delay
        run: sleep 120

      - uses: github/accessibility-scanner@v3
        with:
          urls: |
            ${{ steps.tugboat.outputs.preview_url }}
          repository: az-digital/az_quickstart
          token: ${{ secrets.GH_TOKEN }}
          cache_key: pr-${{ github.event.number }}-scan.json
          include_screenshots: true
```

**Alternative for Phase 2 (no Tugboat coordination needed):** Run the scanner against `quickstart.arizona.edu` after each merge to `main` (not on each PR). This catches post-merge regressions immediately.

**Deliverable:** Accessibility findings surface within minutes of a merge. No regression ships undetected for more than one deploy cycle.

#### Recommended PR check behavior (non-blocking first)

Use this rollout for `az-digital/az_quickstart`:

1. **Weeks 1–2 (observe):** Run PR Axe checks with `continue-on-error: true`, post summary comment, collect baseline noise.
2. **Weeks 3–4 (soft enforce):** Keep non-blocking status check, but require triage labels (`a11y-reviewed`, `a11y-exception`) before merge on high-risk PRs.
3. **Week 5+ (targeted blocking):** Fail only on agreed critical rules (for example: keyboard traps, missing form labels, severe contrast regressions).

This avoids rollout friction while still building reliable CI signal quality.

#### PR gate policy matrix (definitive)

| Stage | Check behavior | Merge impact | Exit criteria to next stage |
|---|---|---|---|
| Stage A (baseline) | Non-blocking (`continue-on-error: true`) + summary comment | None | 2 weeks of stable run reliability |
| Stage B (guardrail) | Non-blocking check + required triage label on serious/critical findings | Low friction | False-positive rate below agreed threshold |
| Stage C (targeted block) | Blocking only on selected high-impact Axe rules | Medium | Team agrees rule set and exception policy |
| Stage D (mature) | Blocking on full agreed baseline + exception SLA | High confidence | Quarterly review and recalibration |

#### CI execution topology (clone vs deployed target)

Use this decision table for where PR/check-in scans run:

| Option | Target scanned | Best use | Pros | Constraints |
|---|---|---|---|---|
| PR preview/staging URL | Rendered deploy preview (Tugboat/staging) | Primary PR signal | Real rendering and integrations | Requires preview environment readiness |
| Local clone in CI job | App started in workflow (`localhost`) | Fast feedback on every check-in | No external deployment dependency | Runner must build/start app reliably |
| Production live URL | Deployed public site | Continuous monitoring | Catches content/config drift in real world | Not ideal as only PR gate |

**Definitive recommendation:** run all three over time, with PR preview/local clone for pre-merge and production URLs for continuous monitoring.

#### CI order of execution per pull request

1. Build app/preview from PR branch.
2. Run Axe-core checks against rendered preview or local CI-hosted clone.
3. Post PR summary (always) and apply policy matrix (Stage A-D).
4. On merge, run smoke live scan on key production URLs.
5. Nightly, run full live inventory scan.

---

### Phase 3 — Pattern Library and Copilot Fixes (Weeks 13–20)
**Goal:** Use finding patterns to drive Quickstart component-level fixes. Leverage Copilot.

By Phase 3, the scanner will have filed dozens (possibly hundreds) of issues with Copilot assignments. The key activities:

| Activity | Description |
|---|---|
| **Component pattern mapping** | Group issues by Quickstart component (`az-card`, `az-hero`, `az-nav`, etc.) to identify which components produce the most violations |
| **Copilot fix review cycle** | Establish a review cadence: Copilot proposes fix → human reviews → merges or provides feedback |
| **Fix pattern documentation** | Document recurring Copilot-suggested fixes that prove correct as "accepted patterns" for future training |
| **Upstream contribution** | Propose accepted component fixes as PRs to `az-digital/az_quickstart`, benefiting all campus sites |
| **Exclusion refinement** | Update `url_configs` to exclude known third-party widgets that generate noise but can't be fixed |

**Deliverable:** At least 5 Quickstart component accessibility fixes contributed upstream. Pattern library document. Copilot fix acceptance rate baseline.

---

### Phase 4 — Continuous Monitoring and Scale (Months 6+)
**Goal:** Operational excellence. Scale to all Quickstart-powered UA sites.

| Activity | Description |
|---|---|
| **Scheduled nightly scan** | Scan full URL inventory nightly, detect any new regressions |
| **Trend dashboard v2** | Enhanced GitHub Pages dashboard showing per-site scores, improvement trends, top violations by component |
| **Integration with DRC** | Flag issues that disproportionately affect users with disabilities (contrast, keyboard, screen reader) with priority labeling |
| **Exception management** | Formal exception request process for known third-party limitations |
| **Arizona Digital partnership** | Regular sync with `az-digital` team to present findings and drive component updates |
| **Leadership reporting** | Monthly one-page summary with KPI progress for leadership review |

---

### Recommended Order of Execution (First 90 Days)

This is the clearest path to find the most issues early while keeping team velocity:

1. **Stabilize live-site baseline first:** Scan top public pages + top user journeys, nightly, with deduplication enabled.
2. **Expand URL coverage systematically:** Add pages from sitemap, nav trees, analytics top pages, and known high-risk templates.
3. **Enable PR Axe checks in non-blocking mode:** Surface regressions per check-in without blocking delivery.
4. **Label and normalize findings:** Severity, WCAG criterion, component, environment, ownership.
5. **Promote high-confidence PR checks to targeted blocking:** Only after 2-4 weeks of baseline data.
6. **Close loop with dashboard and pattern reviews:** Weekly triage and monthly leadership trend review.

### Operational Cadence (Recommended)

| Cadence | What runs | Purpose |
|---|---|---|
| On PR open/update | Axe-core CI check on preview/build (non-blocking at first) | Catch regressions before merge |
| On push to `main` | Fast smoke scan of key live pages | Catch deployment regressions quickly |
| Nightly | Full live-site inventory scan via `accessibility-scanner@v3` | Find broad production/content issues |
| Weekly | Triage + component pattern review | Convert findings into actionable engineering work |
| Weekly | URL discovery QA review (coverage, churn, failures) | Ensure scan target list quality stays high |
| Monthly | Dashboard snapshot + leadership readout | Track trendlines, impact, and accountability |
| Monthly (Executive recheck) | Review previously known high-impact findings, reopened issues, and exception aging | Ensure strategic risks are actively retired, not normalized |

## 6. Deduplication and Noise Reduction

### How the Scanner Prevents Repeated Issue Noise

This is addressed directly by the scanner's `cache_key` mechanism.

**How it works:**

1. On first scan, every new finding generates a GitHub Issue. The finding's fingerprint is stored in the cache.
2. On subsequent scans, the cache is restored. If a finding's fingerprint already exists in the cache AND a linked GitHub Issue exists (open or closed), the finding is skipped.
3. If an issue is closed (fixed), and the violation re-appears in a future scan, the scanner re-files it — because the fix regressed.

**Key design principles for this deployment:**

| Problem | Solution |
|---|---|
| Same violation on 50 pages | Use `open_grouped_issues: true` — one "grouped" tracking issue per violation type instead of 50 individual issues |
| Scanner re-runs same URLs nightly | `cache_key` prevents re-filing already-known issues |
| Third-party widget fires false positives | Use `url_configs[].excludeSelectors` to exclude known noise elements |
| Multiple sites have same systemic issue | Group issues with labels like `component:az-nav` to see cross-site patterns without duplicate issues per site |

**Configuration example for noise-controlled scanning:**

```yaml
url_configs: |
  [
    {
      "url": "https://quickstart.arizona.edu",
      "excludeSelectors": ["iframe[src*='googletagmanager']", ".social-media-feed", "#chat-widget"]
    },
    {
      "url": "https://medicine.arizona.edu",
      "excludeSelectors": ["#third-party-scheduler", ".ads-container"]
    }
  ]
```

**Recommended cache_key naming convention:**

```
az-quickstart-{site-slug}-{branch-or-env}.json
```

Examples:
- `az-quickstart-main-site.json` — production quickstart.arizona.edu
- `az-quickstart-medicine.json` — medicine.arizona.edu
- `az-quickstart-pr-{pr_number}.json` — PR preview environments (auto-expires)

---

## 7. Dashboard and Metrics

### What We Can Build — No New Tools Required

The `accesswatch/azaccess` repo already has a working dashboard pattern. That pattern scales directly to az_quickstart findings.

**Dashboard data flow:**

```
Scanner run
    │
    ▼
results_file JSON
(output of scanner action)
    │
    ├──▶ Committed to gh-cache branch (screenshots, raw results)
    │
    ├──▶ GitHub Issues (queryable via GitHub API)
    │
    └──▶ record-history.js script
              │
              ▼
         docs/reports/history/
         (timestamped JSON snapshots)
              │
              ▼
         GitHub Pages Dashboard
         (static HTML reads JSON, renders charts)
```

### Dashboard Panels — Recommended for Leadership View

| Panel | Description | Data Source |
|---|---|---|
| **Accessibility Health Score** | Weighted score (0–100) based on open critical/serious/moderate issues | GitHub Issues API |
| **Trend Sparkline** | 30/60/90-day issue count trend | History JSON |
| **Top 10 Violations** | Most common violation types across all scanned sites | Grouped issues |
| **Component Heat Map** | Which Quickstart components generate the most issues | Issue labels |
| **Site Scorecard** | Per-site issue count and severity breakdown | Results JSON |
| **Resolution Velocity** | Issues closed per sprint / average days-to-close | GitHub Issues API |
| **Copilot Fix Rate** | Percentage of Copilot-assigned issues that produced accepted PRs | PR API |
| **WCAG Criterion Breakdown** | Which WCAG success criteria are most frequently violated | Violation IDs mapped to criteria |

### Dashboard vNext (Training + Awareness + High Impact)

Add these views to turn data into behavior change:

| Panel | Why it matters |
|---|---|
| **High-Impact Issues** | Ranks violations by user impact x page traffic x time open so teams fix what hurts users most first |
| **Regression Radar** | Highlights "new this week" issues by component and release to show where quality slipped |
| **Top Repeat Offenders** | Shows recurring rule failures and templates causing repeated violations |
| **Fix Effectiveness** | Tracks reopened/regressed issues after closure to measure true fix quality |
| **Team Learning Feed** | Weekly "what we learned" cards from accepted fixes, mapped to components and WCAG |
| **Exception Debt Tracker** | Counts temporary exceptions, age, owner, and expiration date to prevent permanent debt |

**Implementation note:** Build this with static JSON snapshots + GitHub Pages (no new paid tooling required).

### Dashboard delivery plan (phased)

| Phase | Deliverable | Timebox |
|---|---|---|
| Phase A | Executive scorecard (health score, trendline, top violations, high-impact queue) | 1-2 weeks |
| Phase B | Engineering drilldowns (component heat map, regression radar, exception debt) | 2-3 weeks |
| Phase C | Training layer (team learning feed, accepted fix patterns, "before/after" examples) | 2 weeks |
| Phase D | Operational automation (weekly snapshot generation, monthly export packet) | 1 week |

### Dashboard data model (recommended columns)

Use these core columns so the dashboard supports trend analysis, ownership routing, and executive rechecks:

| Column | Description |
|---|---|
| `snapshot_date` | Date of dashboard snapshot |
| `environment` | `pr-preview`, `staging`, or `production` |
| `site` | Site/domain being scanned |
| `page_url` | Page where finding was detected |
| `component` | Quickstart component or template area |
| `rule_id` | Axe rule identifier (for example `color-contrast`) |
| `wcag_criterion` | Mapped WCAG criterion (for example `1.4.3`) |
| `impact` | `critical`, `serious`, `moderate`, `minor` |
| `issue_number` | Linked GitHub issue number |
| `issue_state` | `open` or `closed` |
| `first_seen_at` | First detection date |
| `last_seen_at` | Most recent detection date |
| `recheck_status` | `persistent`, `resolved`, `regressed`, `exception-approved` |
| `exception_expiry` | Date approved exception expires (if applicable) |
| `owner_role` | `content-editor`, `site-builder`, `dev` |
| `owner_team` | Responsible team/group |
| `days_open` | Age of currently open issue |
| `traffic_band` | Relative page traffic bucket (high/medium/low) |
| `copilot_assigned` | Whether issue was assigned to Copilot |
| `fix_pr_number` | Linked fix PR when available |
| `fix_outcome` | `accepted`, `rejected`, `pending` |

### Metrics definitions (for consistency)

Use explicit formulas so leadership and engineering read the same signal:

- **Accessibility Health Score (0-100):** `100 - weighted_open_issue_rate`, weighted by severity (`critical > serious > moderate > minor`).
- **Regression Rate:** `new_issues_this_period / pages_scanned_this_period`.
- **Fix Throughput:** `issues_closed_this_period / issues_opened_this_period`.
- **Mean Time to Resolution (MTTR):** `average(days_open)` for closed issues in period.
- **High-Impact Backlog:** count of open issues where `severity >= serious` and page traffic is above threshold.

### Recommended Label Taxonomy for az_quickstart Issues

```
# Severity (from scanner)
impact:critical
impact:serious
impact:moderate
impact:minor

# WCAG level
wcag:1.4.3-contrast
wcag:1.1.1-alt-text
wcag:4.1.2-name-role-value
wcag:2.4.1-bypass-blocks
# ... etc.

# Component
component:az-card
component:az-hero
component:az-nav
component:az-footer
component:az-accordion
# ... etc.

# Environment
env:production
env:pr-preview
env:staging

# State
needs-review
copilot-assigned
accepted-fix
exception-approved
```

---

## 8. Pattern Learning Strategy

### The Learning Flywheel

Each scanner run teaches you something. The goal is to build a compounding knowledge system:

```
Scan runs
    │
    ▼
Issues filed (labeled with component + WCAG criterion)
    │
    ▼
Copilot proposes fix
    │
    ▼
Human reviews and merges (or rejects with feedback)
    │
    ▼
Pattern documented:
  "az-card component: images without alt text
   → Fix: Add aria-label to card image wrapper"
    │
    ▼
Fix proposed upstream to az-digital/az_quickstart
    │
    ▼
Upstream merge → all campus sites benefit
    │
    ▼
Scanner confirms fix on next run → issue stays closed
    │
    ▼
Pattern added to exclusion list (not noise, just fixed)
```

### Pattern Library Artifact

Maintain a `PATTERNS.md` in `accesswatch/az_quickstart` that documents:
- Which component generated the issue
- The WCAG criterion violated
- The Copilot-suggested fix (or manually crafted fix)
- Acceptance status (accepted / rejected / pending)
- Link to the upstream PR if contributed

This becomes an invaluable learning resource and a source document for Arizona Digital's own accessibility documentation.

---

## 9. Resource Requirements

### Personnel

| Role | Phase 0–1 | Phase 2–3 | Phase 4+ |
|---|---|---|---|
| Accessibility Lead (Jeff Bishop) | 15–20 hrs | 10 hrs/sprint | 4–6 hrs/sprint |
| Frontend Developer (Arizona Digital) | 2 hrs | 8 hrs/sprint | 2 hrs/sprint |
| DevOps / GitHub Admin | 1 hr | 4 hrs | 1 hr/sprint |
| QA / Tester | 0 hrs | 4 hrs/sprint | 2 hrs/sprint |

### Infrastructure Costs

| Item | Cost | Notes |
|---|---|---|
| GitHub Actions minutes | $0 | Included in current GitHub plan |
| `github/accessibility-scanner@v3` | $0 | Open source, MIT license |
| GitHub Issues storage | $0 | Included |
| GitHub Pages (dashboard) | $0 | Included |
| GitHub Copilot (fix suggestions) | Existing license | Already required for full scanner functionality |
| **Total** | **$0 additional** | Leverages existing GitHub infrastructure |

---

## 10. Success Metrics and KPIs

### Phase 0 (Proof of Concept)

- [ ] First scanner run completes successfully against `quickstart.arizona.edu`
- [ ] Issues filed correctly in `accesswatch/az_quickstart`
- [ ] Zero duplicate issues on second run (cache working)
- [ ] Grouped issues correctly cluster related violations

### 90-Day KPIs

| Metric | Baseline | 90-Day Target |
|---|---|---|
| Critical violations in production Quickstart sites | TBD (first scan) | -50% |
| Open a11y issues with accepted Copilot fix | 0 | 10+ |
| Quickstart components with documented a11y patterns | 0 | 5+ |
| Unique URLs scanned | 0 | 20+ |
| Upstream PRs contributed to `az-digital/az_quickstart` | 0 | 2+ |

### 12-Month KPIs

| Metric | 12-Month Target |
|---|---|
| Critical violations in production | -90% from baseline |
| Accessibility health score (0–100) | 85+ |
| Copilot fix acceptance rate | 60%+ |
| Developer awareness (survey) | 80%+ "I use the scanner results in my workflow" |
| Upstream component fixes | 10+ merged to `az-digital/az_quickstart` |

---

## 11. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Arizona Digital team not yet onboarded to scanner | Medium | High | Phase 0 runs in `accesswatch` — no upstream coordination needed initially |
| Drupal rendering complexity breaks scan | Low | Medium | Start with public pages; adjust Playwright wait times via `url_configs` |
| Issue volume overwhelms reviewers | Medium | Medium | `open_grouped_issues: true` + label taxonomy keeps volume manageable |
| Tugboat preview URLs are ephemeral | Low | Low | Use per-PR `cache_key` with PR number; cache auto-expires with PR |
| Third-party widgets generate noise | High | Low | `excludeSelectors` in `url_configs` handles this precisely |
| `GH_TOKEN` PAT management | Low | High | Use fine-grained PAT scoped to specific repos; rotate every 12 months |
| Copilot suggests incorrect fixes | Medium | Medium | Always require human review before merge — this is documented scanner behavior |

---

## 12. Appendices

### Appendix A: Immediate Next Steps Checklist

Copy this into a GitHub Project board or sprint:

```
PHASE 0 SPRINT
─────────────────────────────────────────────────────────────────
[ ] Create fine-grained PAT (GH_TOKEN) with write access to:
    - accesswatch/az_quickstart (contents, issues, pull-requests)
    - accesswatch/azaccess (contents)
    
[ ] Add GH_TOKEN as repository secret in accesswatch/azaccess

[ ] Create .github/workflows/az-quickstart-scan.yml in accesswatch/azaccess
    (workflow code is in Appendix B)

[ ] Run workflow manually (workflow_dispatch) and observe results

[ ] Review filed issues in accesswatch/az_quickstart

[ ] Run workflow a second time — confirm zero duplicate issues (cache works)

[ ] Add label taxonomy to accesswatch/az_quickstart (see Section 7)

[ ] Share Phase 0 findings with Arizona Digital team
```

### Appendix B: Complete Phase 0 Workflow File

Save as `.github/workflows/az-quickstart-scan.yml` in `accesswatch/azaccess`:

```yaml
name: AZ Quickstart Accessibility Scan

on:
  workflow_dispatch:
  schedule:
    # Monday at 6am MST (13:00 UTC)
    - cron: '0 13 * * 1'

concurrency:
  group: az-quickstart-scan
  cancel-in-progress: true

jobs:
  scan_quickstart_public:
    name: Scan Quickstart Public Pages
    runs-on: ubuntu-latest
    steps:
      - uses: github/accessibility-scanner@v3
        with:
          urls: |
            https://quickstart.arizona.edu
            https://quickstart.arizona.edu/best-practices/accessibility-guidelines
            https://quickstart.arizona.edu/create-content/editor-toolbar
            https://quickstart.arizona.edu/get-started/overview
            https://quickstart.arizona.edu/news
            https://quickstart.arizona.edu/arizona-sites-training-support
          repository: accesswatch/az_quickstart
          token: ${{ secrets.GH_TOKEN }}
          cache_key: az-quickstart-main-site.json
          include_screenshots: true
          open_grouped_issues: true
          scans: '["axe", "reflow-scan"]'

  scan_quickstart_powered_sites:
    name: Scan Quickstart-Powered UA Sites
    runs-on: ubuntu-latest
    needs: scan_quickstart_public
    steps:
      - uses: github/accessibility-scanner@v3
        with:
          url_configs: |
            [
              {"url": "https://medicine.arizona.edu", "excludeSelectors": []},
              {"url": "https://eller.arizona.edu", "excludeSelectors": []},
              {"url": "https://capla.arizona.edu", "excludeSelectors": []},
              {"url": "https://drc.arizona.edu", "excludeSelectors": []},
              {"url": "https://ischool.arizona.edu", "excludeSelectors": []}
            ]
          repository: accesswatch/az_quickstart
          token: ${{ secrets.GH_TOKEN }}
          cache_key: az-quickstart-campus-sites.json
          include_screenshots: true
          open_grouped_issues: true
          scans: '["axe", "reflow-scan"]'
```

### Appendix C: Relationship to Existing ACCESSIBILITY-CI-PROPOSAL.md

The `ACCESSIBILITY-CI-PROPOSAL.md` in `accesswatch/azaccess` is a complementary document focused on **CI gates using axe-core/Lighthouse/Pa11y CLI tools** run against a built artifact. This plan focuses on **the `github/accessibility-scanner@v3` action** which runs against live URLs.

These are not competing approaches — they are complementary and should run together:

| Approach | Best For | Tool |
|---|---|---|
| CI artifact scan (existing proposal) | React/Vue/Next.js static sites with build artifacts | axe-core CLI + Lighthouse CI + Pa11y |
| Live URL scan (this plan) | Drupal/Quickstart sites that require a running server | `github/accessibility-scanner@v3` |
| Both combined | Complete coverage: catch issues at build time AND in rendered context | Both workflows running in parallel |

For Arizona Quickstart specifically (a Drupal distribution), **live URL scanning is the right primary approach** because the rendered output depends on Drupal's templating, CMS content, and contributed modules — none of which are visible in source code alone.

For CI check-ins and pull requests, use **Axe-core as the primary gate signal** and keep it non-blocking initially until false positive/noise rates are stable.

### Appendix D: Scanner Inputs Reference

Full reference for the `github/accessibility-scanner@v3` action inputs used in this plan:

| Input | This Plan's Usage |
|---|---|
| `urls` | List of Quickstart-powered site URLs |
| `url_configs` | Per-site URL with `excludeSelectors` for third-party widgets |
| `repository` | `accesswatch/az_quickstart` — where issues are filed |
| `token` | Fine-grained PAT with write access to `az_quickstart` |
| `cache_key` | Prevents re-filing known issues; one key per site group |
| `include_screenshots` | Visual evidence attached to every issue |
| `open_grouped_issues` | One tracking issue per violation type (reduces noise) |
| `scans` | `["axe", "reflow-scan"]` — both desktop and mobile reflow |
| `skip_copilot_assignment` | `false` — assign to Copilot for fix suggestions |

---

### Appendix E: Practical CI Target Patterns

#### Pattern 1: Scan PR preview URL (recommended when available)

```yaml
name: PR Accessibility (Preview URL)
on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  pr_preview_scan:
    runs-on: ubuntu-latest
    steps:
      - name: Wait for preview deployment
        run: sleep 120

      - uses: github/accessibility-scanner@v3
        with:
          urls: |
            ${{ steps.preview.outputs.url }}
          repository: az-digital/az_quickstart
          token: ${{ secrets.GH_TOKEN }}
          cache_key: az-quickstart-pr-${{ github.event.number }}.json
          include_screenshots: true
          open_grouped_issues: true
```

#### Pattern 2: Scan local clone served in CI (no preview dependency)

```yaml
name: PR Accessibility (Local Clone)
on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  pr_local_scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build and start app
        run: |
          npm ci
          npm run build
          npm run start & npx wait-on http://localhost:3000

      - uses: github/accessibility-scanner@v3
        with:
          urls: |
            http://localhost:3000
          repository: az-digital/az_quickstart
          token: ${{ secrets.GH_TOKEN }}
          cache_key: az-quickstart-pr-${{ github.event.number }}-localhost.json
          include_screenshots: true
```

#### Pattern 3: Private clone/stage behind authentication

Use a reachable internal URL and pass authentication context:

```yaml
with:
  urls: |
    https://staging.example.arizona.edu
  login_url: https://staging.example.arizona.edu/login
  auth_context: ${{ secrets.A11Y_AUTH_CONTEXT }}
```

This supports non-public clone environments while still scanning rendered pages.

---

### Appendix F: Multi-CMS URL Discovery Pattern (Drupal + WordPress)

For mixed estates, run one discovery pipeline with CMS adapters enabled and merge outputs into one scanner input:

```yaml
- id: discover
  uses: github/accessibility-scanner/.github/actions/discover@v3
  with:
    seed_urls: |
      https://example-drupal.edu
      https://example-wordpress.edu
    sitemap_urls: |
      https://example-drupal.edu/sitemap.xml
      https://example-wordpress.edu/sitemap_index.xml
    drupal_routes_url: https://example-drupal.edu/discovery-routes.json
    wordpress_base_url: https://example-wordpress.edu/wp-json/wp/v2
```

Then hand off:

```yaml
url_configs: ${{ steps.discover.outputs.url_configs }}
```

---

### Appendix G: GLOW Pilot Workflow

Use `sites/glow-discovery-scan.yml` as the pilot template for:
- repo: `community-access/glow`
- site: `https://www.letitglow.app`
- discovery + scan in one workflow run.

---

## Document Revision History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-05-27 | Jeff Bishop | Initial draft |
| 1.1 | 2026-05-27 | Jeff Bishop | Added dual-track model, execution order, cadence, non-blocking PR rollout, and dashboard vNext recommendations |
| 1.2 | 2026-05-27 | Jeff Bishop | Added CI execution topology, pull request run order, and concrete clone/preview/private target workflow patterns |
| 1.3 | 2026-05-27 | Jeff Bishop | Rewrote executive summary as definitive Axe-core + accessibility-scanner integration strategy for leadership |
| 1.4 | 2026-05-27 | Jeff Bishop | Expanded executive summary with phased dashboard plan, leadership reporting intent, and monthly decision framing |
| 1.5 | 2026-05-27 | Jeff Bishop | Added U of A Quickstart business-process alignment: role-based ownership, training integration, and ServiceNow escalation path |
| 1.6 | 2026-05-27 | Jeff Bishop | Clarified Playwright runtime role, added executive recheck governance, and defined dashboard column-level data model |
| 1.7 | 2026-05-27 | Jeff Bishop | Added automated URL discovery pipeline, discovery quality gates, and weekly URL-discovery QA cadence |
| 1.8 | 2026-05-27 | Jeff Bishop | Expanded executive summary with rendered-target requirement and direct jump links to core strategy, automation, cadence, deduplication, and dashboard sections |
| 1.9 | 2026-05-27 | Jeff Bishop | Added implemented discovery action details, mixed Drupal/WordPress pattern appendix, and GLOW pilot workflow reference |

---

*For questions about this plan, contact the Digital Accessibility team at [accessibility@arizona.edu](mailto:accessibility@arizona.edu).*

*This document references the [GitHub Accessibility Scanner](https://github.com/github/accessibility-scanner) (MIT License), the [Arizona Quickstart](https://quickstart.arizona.edu) distribution maintained by [Arizona Digital](https://digital.arizona.edu/), and the [accesswatch/azaccess](https://github.com/accesswatch/azaccess) prototype work.*
