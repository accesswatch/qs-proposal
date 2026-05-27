# QS Proposal: Real-World Accessibility Pilot Stack

This repo is a production-style proposal package for the Quickstart team to review and run.

It includes:
1. A dual-track scanning model (PR CI + live-site monitoring).
2. Automated URL discovery (sitemap + crawl + Drupal/WordPress adapters).
3. Pilot workflows for GLOW and Quickstart.
4. Dashboard generation and publishing-ready artifacts.
5. Strategic planning docs in both Markdown and HTML.

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
2. Scans discovered URLs with `github/accessibility-scanner@v3`.
3. Files findings to `accesswatch/qs-proposal` issues.

### Dashboard refresh workflow

File: `.github/workflows/dashboard-refresh.yml`

1. Pulls current issue state from `accesswatch/qs-proposal`.
2. Recomputes summary metrics and top violations.
3. Writes `dashboard/data/latest.json`.
4. Appends timestamped history snapshot.

## Required setup

### Secret: `GH_TOKEN`

Add a fine-grained PAT as repository secret in `accesswatch/qs-proposal`:
- `issues: write`
- `contents: write`
- `pull_requests: write`
- `metadata: read`
- `actions: write`

Note: `github/accessibility-scanner` requires this token input.

## Run it now

1. Open **Actions** in `accesswatch/qs-proposal`.
2. Run **Pilot Accessibility Scan (Quickstart + GLOW)**.
3. Review created issues.
4. Run **Dashboard Refresh**.
5. Open `dashboard/index.html` (or publish via GitHub Pages).

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
