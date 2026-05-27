# discover

Discovers URLs from sitemap files, CMS sources, and bounded crawling to produce scanner-ready inputs.

## Usage

### Inputs

#### `seed_urls`

Optional newline-delimited URLs used as crawl seeds (and fallback domain allow-list source).

#### `sitemap_urls`

Optional newline-delimited sitemap or sitemap-index URLs.

#### `drupal_routes_url`

Optional Drupal JSON endpoint containing route/content links.

#### `wordpress_base_url`

Optional WordPress REST base URL (for example: `https://example.com/wp-json/wp/v2`).

#### `include_domains`

Optional hostname allow-list (newline-delimited). If omitted, the action derives domains from seed/sitemap inputs.

#### `exclude_url_patterns`

Optional regex patterns (newline-delimited). Matching URLs are excluded.

#### `max_depth`

Optional crawl depth (default: `2`).

#### `max_urls`

Optional maximum output URLs (default: `500`).

#### `max_sitemap_files`

Optional maximum recursively fetched sitemap files (default: `50`).

#### `max_wordpress_pages`

Optional max paginated requests per WordPress collection (default: `20`).

#### `request_timeout_ms`

Optional request timeout (default: `10000`).

#### `crawl_enabled`

Optional toggle for bounded crawling from seed URLs (default: `true`).

### Outputs

#### `url_configs`

Stringified JSON array compatible with `github/accessibility-scanner@v3` input `url_configs`.

#### `url_configs_file`

Path to JSON file containing discovered URL config objects.

#### `urls`

Newline-delimited discovered URLs.

#### `count`

Total discovered URL count.

## Example

```yaml
- id: discover
  uses: github/accessibility-scanner/.github/actions/discover@v3
  with:
    seed_urls: |
      https://www.letitglow.app
    sitemap_urls: |
      https://www.letitglow.app/sitemap.xml
    max_depth: 2
    max_urls: 300

- uses: github/accessibility-scanner@v3
  with:
    url_configs: ${{ steps.discover.outputs.url_configs }}
    repository: community-access/glow
    token: ${{ secrets.GH_TOKEN }}
    cache_key: glow-production.json
```
