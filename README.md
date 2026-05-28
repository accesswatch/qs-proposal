# QS Proposal: Real-World Accessibility Pilot Stack

This repo is a production-style proposal package for the Quickstart team to review and run.

It includes:
1. A dual-track scanning model (PR CI + live-site monitoring).
2. Automated URL discovery (sitemap + crawl + Drupal/WordPress adapters).
3. Pilot workflows for GLOW and Quickstart.
4. Dashboard generation and publishing-ready artifacts.
5. Strategic planning docs in both Markdown and HTML.

## Program status note (May 2026)

This `qs-proposal` repo is the planning and reporting source of truth for the current remediation wave.

Latest tracked status:
1. DRC reported **2026 potential issues this week** via two CSV files (`Summary` + `Detail`), totaling **346 occurrences** across **10 issue IDs**.
2. High/medium-confidence remediation work was opened upstream in `az-digital/az_quickstart`:
   - PR #5639 (`accessibility-fixes-high-confidence`)
   - PR #5640 (`accessibility-fixes-medium-confidence`)
   - PR #5641 (`accessibility-fixes-button-names`)
   - PR #5642 (`accessibility-fixes-mobile-nav-callback`)
   - PR #5643 (`accessibility-fixes-carousel-aria`)
   - PR #5644 (`accessibility-fixes-high-confidence-round2`)
   - PR #5645 (`accessibility-fixes-high-confidence-round3`)
3. CI/workflow reliability fixes were applied where needed:
   - Composer audit check now distinguishes true vulnerability failures from abandoned-package-only output.
   - Carousel JS lint failures were corrected.
4. Tugboat preview coverage is now available for PR #5639-#5645, including PR #5639 (`https://pr5639-qxgkrp3cc8zfunxaiz5kh7tdzpqof0tk.tugboatqa.com`).
5. Before/after reporting is scoped to the same URL set; projected impact remains pending post-merge verification scans.

## For az-digital team members

This repository is the **program operations and reporting repo** for the Quickstart accessibility effort.

Use it for:
1. Reviewing current remediation status, PR mapping, and rollout notes.
2. Running scanner workflows and discovery workflows.
3. Refreshing dashboard snapshots and leadership reporting artifacts.

Do not use it for:
1. Shipping Quickstart product code changes (those belong in `az-digital/az_quickstart` PRs).
2. Treating projected reduction values as final closure without same-scope verification rescans.

Recommended operating flow for the az-digital team:
1. Review open PR wave status (#5639-#5645) and Tugboat previews.
2. Run scan workflows in non-filing mode first (`file_issues=false`) for signal quality checks.
3. Enable filing only for intentional remediation cycles (`file_issues=true`).
4. Run Dashboard Refresh after each validated cycle.
5. Use refreshed snapshots for leadership readouts and weekly governance review.

## Stack overview

### 1) Discovery layer

- Local action: `/.github/actions/discover`
- Sources:
  - `sitemap.xml` and sitemap indexes
  - bounded crawling from seed URLs
  - optional Drupal route endpoint (`drupal_routes_url`)
  - optional WordPress REST endpoint (`wordpress_base_url`)
- Output:
  - scanner-ready `url_configs` JSON

### 2) Scan layer

- Action: `github/accessibility-scanner@v3`
- Scans rendered pages with Playwright + Axe-core (and optional reflow scan).
- Files issues into target repo and deduplicates with `cache_key`.

### 3) Reporting/dashboard layer

- Dashboard app: `dashboard/index.html`
- Includes rule-level online help links and drill-in scenario guidance for top/repeated violations.
- Includes an Action Center with prioritized fixes, likely owner teams, likely fix areas, and one-click issue drafts.
- Action Center now groups by fixable pattern (not per-instance noise) and includes occurrence/path blast radius for actionable issue drafts.
- Includes remediation tracking deltas between snapshots and dedupe/ignore guardrails so repeated or ignored findings do not inflate executive metrics.
- Includes Validation Wins panels so rule passes/resolved rules are visible alongside failures.
- Data files:
  - `dashboard/data/latest.json`
  - `dashboard/data/history/*.json`
- Refresh pipeline:
  - `.github/workflows/dashboard-refresh.yml`
  - `scripts/update-dashboard-data.mjs`

### 4) Proposal docs

- `QUICKSTART-ACCESSIBILITY-PLAN.md` / `.html`
- `todo.md` / `.html`
- `README.md` / `.html`
- `.github/actions/discover/README.md` / `.html`

## Workflows in this repo

### Pilot scan workflow (real-world)

File: `.github/workflows/pilot-scan.yml`

Runs two pilot tracks:
1. **Quickstart** (`https://quickstart.arizona.edu`)
2. **GLOW** (`https://www.letitglow.app`)

Each track:
1. Discovers URLs.
2. Scans discovered URLs with `github/accessibility-scanner@v3` only when `file_issues=true`.
3. Keeps issue filing manual-only by default (`file_issues=false`).

### Quickstart full-sitemap rescan workflow

File: `.github/workflows/quickstart-sitemap-rescan.yml`

This workflow scans Quickstart using the full sitemap chunk input checked into:
- `scan-input/quickstart-sitemap/chunks.json`
- `scan-input/quickstart-sitemap/chunk-*.json`

It runs each chunk in parallel and writes a run summary with total URL and chunk counts.

### PR/check-in simulation workflow

File: `.github/workflows/pr-checkin-simulation.yml`

This covers CI-style pre-merge behavior:
1. Runs on `workflow_dispatch` only.
2. Discovers URLs from a target rendered endpoint.
3. Runs scanner with non-blocking or enforced mode when `file_issues=true`.
4. Publishes a step summary showing target, URL count, mode, and outcome.

Default target is `https://quickstart.arizona.edu`, and workflow-dispatch lets you pass any preview/staging URL.

### Dashboard refresh workflow

File: `.github/workflows/dashboard-refresh.yml`

1. Pulls current issue state from `accesswatch/qs-proposal`.
2. Recomputes summary metrics and top violations.
3. Writes `dashboard/data/latest.json` with executive brief + drill-downs + action center + scan operations simulation.
4. Appends timestamped history snapshot.
5. Generates static email-ready report at `dashboard/static/latest-report.html`.

### Configurable scan workflow (frontend/manual/admin)

File: `.github/workflows/configurable-scan.yml`

This workflow supports mixed operating modes from one entrypoint:
1. **workflow_dispatch** for frontend/manual launch requests.
2. **Mode options**: `delta` (new-issue-focused) and `complete` (authoritative full scan).
3. **Rule profiles**: `focused-rules`, `all-rules`, and `axe-only`.
4. **Issue filing control**: `file_issues` (default `false`) to prevent automatic issue creation.
5. Publishes run summary with selected combination and discovered URL count.

## Required setup

### Secret: `GH_TOKEN`

Add a fine-grained PAT as repository secret in `accesswatch/qs-proposal`:
- `issues: write`
- `contents: write`
- `pull_requests: write`
- `metadata: read`
- `actions: write`

Note: `github/accessibility-scanner` requires this token input.

### Secret: `GLOW_AUTH_CONTEXT` (recommended for consent-gated scans)

Add a repository secret named `GLOW_AUTH_CONTEXT` containing scanner `auth_context` JSON so the GLOW scan can run with an accepted consent/session state.

Example shape:

```json
{
  "cookies": [
    {"name":"consent","value":"true","domain":"www.letitglow.app","path":"/"}
  ],
  "localStorage": {
    "https://www.letitglow.app": {
      "consentAccepted":"true"
    }
  }
}
```

Without this, many discovered URLs can redirect through `/consent?next=...`, which reduces scan fidelity.

## Run it now

1. Open **Actions** in `accesswatch/qs-proposal`.
2. Run **Pilot Accessibility Scan (Quickstart + GLOW)** for discovery/scan readiness.
3. Run **PR Check-in Accessibility Simulation** to test CI-style behavior.
4. Run **Configurable Accessibility Scan** for frontend/admin mode combinations.
5. Set `file_issues=true` only when you intentionally want issue creation.
6. Run **Dashboard Refresh**.
7. Open `dashboard/index.html` (or publish via GitHub Pages).
8. Open `dashboard/static/latest-report.html` for email/share snapshots.

For full sitemap verification, run **Quickstart Full Sitemap Rescan**.

## How to simulate PR flow end-to-end

1. Create a short-lived branch in this repo and open a PR.
2. Confirm `PR Check-in Accessibility Simulation` runs automatically.
3. For manual simulation, run the workflow with:
   - `target_url` = preview/staging/live rendered endpoint
   - `non_blocking` = `true` first, then `false` for gate rehearsal
   - `file_issues` = `false` for dry-runs, `true` only for intentional filing
4. Review run summary + filed issues.
5. Use this to tune rule thresholds and blocking policy before upstream rollout.

## Pilot tuning knobs

In `.github/workflows/pilot-scan.yml`, adjust:
- `max_depth`
- `max_urls`
- `include_domains`
- `exclude_url_patterns`
- `cache_key`
- `scans` (`["axe","reflow-scan"]`)

## What “real world” means here

This repo now has a runnable end-to-end operating model.  
The only non-repo dependencies are org permissions, secrets, and scan target reachability.

## Rebuilding full sitemap chunks from a local XML file

If you have a local sitemap file (example: `C:\code\data.xml`), rebuild the scan input with:

```bash
node scripts/build-quickstart-sitemap-input.mjs "C:\code\data.xml" "scan-input/quickstart-sitemap" 40
```

This writes:
- `scan-input/quickstart-sitemap/urls.txt`
- `scan-input/quickstart-sitemap/chunks.json`
- `scan-input/quickstart-sitemap/chunk-001.json` ... `chunk-XXX.json`
