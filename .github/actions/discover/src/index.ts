import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import * as core from '@actions/core'

type UrlConfig = {url: string}

type DiscoverOptions = {
  seedUrls: string[]
  sitemapUrls: string[]
  drupalRoutesUrl?: string
  wordpressBaseUrl?: string
  includeDomains: string[]
  excludePatterns: RegExp[]
  maxDepth: number
  maxUrls: number
  maxSitemapFiles: number
  maxWordpressPages: number
  requestTimeoutMs: number
  crawlEnabled: boolean
  userAgent: string
}

export default async function () {
  const options = loadOptions()
  const discovered = new Set<string>()

  const domainAllowList = buildDomainAllowList(options)
  const addUrlIfAllowed = (candidate: string) => {
    const normalized = normalizeUrl(candidate)
    if (!normalized) return
    if (!isAllowedUrl(normalized, domainAllowList, options.excludePatterns)) return
    discovered.add(normalized)
  }

  for (const url of options.seedUrls) addUrlIfAllowed(url)

  if (options.sitemapUrls.length > 0) {
    const sitemapUrls = await discoverFromSitemaps(options.sitemapUrls, options)
    for (const url of sitemapUrls) addUrlIfAllowed(url)
  }

  if (options.drupalRoutesUrl) {
    const drupalUrls = await discoverFromDrupal(options.drupalRoutesUrl, options)
    for (const url of drupalUrls) addUrlIfAllowed(url)
  }

  if (options.wordpressBaseUrl) {
    const wpUrls = await discoverFromWordPress(options.wordpressBaseUrl, options)
    for (const url of wpUrls) addUrlIfAllowed(url)
  }

  if (options.crawlEnabled && options.seedUrls.length > 0) {
    const crawledUrls = await crawlFromSeeds(options.seedUrls, options, domainAllowList)
    for (const url of crawledUrls) addUrlIfAllowed(url)
  }

  const urls = [...discovered].slice(0, options.maxUrls).sort()
  const urlConfigs: UrlConfig[] = urls.map(url => ({url}))
  const urlConfigsSerialized = JSON.stringify(urlConfigs)

  const resultsPath = path.join(process.env.RUNNER_TEMP || '/tmp', `url-configs-${crypto.randomUUID()}.json`)
  fs.writeFileSync(resultsPath, urlConfigsSerialized)

  core.setOutput('url_configs', urlConfigsSerialized)
  core.setOutput('url_configs_file', resultsPath)
  core.setOutput('urls', urls.join('\n'))
  core.setOutput('count', String(urls.length))

  core.info(`Discovered ${urls.length} URLs`)
}

function loadOptions(): DiscoverOptions {
  const seedUrls = core.getMultilineInput('seed_urls', {required: false}).map(v => v.trim()).filter(Boolean)
  const sitemapUrls = core.getMultilineInput('sitemap_urls', {required: false}).map(v => v.trim()).filter(Boolean)
  const includeDomains = core.getMultilineInput('include_domains', {required: false}).map(v => v.trim()).filter(Boolean)
  const excludePatterns = parseExcludePatterns(
    core.getMultilineInput('exclude_url_patterns', {required: false}).map(v => v.trim()).filter(Boolean),
  )

  if (seedUrls.length === 0 && sitemapUrls.length === 0 && !core.getInput('drupal_routes_url') && !core.getInput('wordpress_base_url')) {
    throw new Error("Provide at least one discovery source: 'seed_urls', 'sitemap_urls', 'drupal_routes_url', or 'wordpress_base_url'.")
  }

  const maxDepth = parsePositiveInt(core.getInput('max_depth', {required: false}) || '2', 'max_depth')
  const maxUrls = parsePositiveInt(core.getInput('max_urls', {required: false}) || '500', 'max_urls')
  const maxSitemapFiles = parsePositiveInt(
    core.getInput('max_sitemap_files', {required: false}) || '50',
    'max_sitemap_files',
  )
  const maxWordpressPages = parsePositiveInt(
    core.getInput('max_wordpress_pages', {required: false}) || '20',
    'max_wordpress_pages',
  )
  const requestTimeoutMs = parsePositiveInt(
    core.getInput('request_timeout_ms', {required: false}) || '10000',
    'request_timeout_ms',
  )

  return {
    seedUrls,
    sitemapUrls,
    drupalRoutesUrl: emptyToUndefined(core.getInput('drupal_routes_url', {required: false}).trim()),
    wordpressBaseUrl: emptyToUndefined(core.getInput('wordpress_base_url', {required: false}).trim()),
    includeDomains,
    excludePatterns,
    maxDepth,
    maxUrls,
    maxSitemapFiles,
    maxWordpressPages,
    requestTimeoutMs,
    crawlEnabled: parseBoolean(core.getInput('crawl_enabled', {required: false}) || 'true', 'crawl_enabled'),
    userAgent: (core.getInput('user_agent', {required: false}) || 'accessibility-scanner-discover/1.0').trim(),
  }
}

function buildDomainAllowList(options: DiscoverOptions): string[] {
  if (options.includeDomains.length > 0) return options.includeDomains.map(v => v.toLowerCase())

  const discoveredDomains = new Set<string>()
  for (const raw of [...options.seedUrls, ...options.sitemapUrls]) {
    const hostname = safeHostname(raw)
    if (hostname) discoveredDomains.add(hostname.toLowerCase())
  }
  return [...discoveredDomains]
}

async function discoverFromSitemaps(sitemapUrls: string[], options: DiscoverOptions): Promise<Set<string>> {
  const foundUrls = new Set<string>()
  const visitedSitemaps = new Set<string>()
  const queue = [...sitemapUrls]

  while (queue.length > 0 && visitedSitemaps.size < options.maxSitemapFiles) {
    const current = queue.shift()!
    const normalized = normalizeUrl(current)
    if (!normalized || visitedSitemaps.has(normalized)) continue
    visitedSitemaps.add(normalized)

    try {
      const xml = await fetchText(normalized, options)
      const parsed = parseSitemapLocs(xml)
      parsed.urls.forEach(url => foundUrls.add(url))
      for (const nested of parsed.sitemaps) {
        if (!visitedSitemaps.has(nested) && queue.length + visitedSitemaps.size < options.maxSitemapFiles) {
          queue.push(nested)
        }
      }
    } catch (error) {
      core.warning(`Sitemap fetch failed for ${normalized}: ${String(error)}`)
    }
  }

  return foundUrls
}

async function discoverFromDrupal(drupalRoutesUrl: string, options: DiscoverOptions): Promise<Set<string>> {
  const foundUrls = new Set<string>()
  try {
    const body = await fetchText(drupalRoutesUrl, options)
    const parsed = JSON.parse(body)
    for (const candidate of collectUrlCandidates(parsed)) foundUrls.add(candidate)
  } catch (error) {
    core.warning(`Drupal route discovery failed for ${drupalRoutesUrl}: ${String(error)}`)
  }
  return foundUrls
}

async function discoverFromWordPress(wordpressBaseUrl: string, options: DiscoverOptions): Promise<Set<string>> {
  const foundUrls = new Set<string>()
  for (const resource of ['pages', 'posts']) {
    for (let page = 1; page <= options.maxWordpressPages; page++) {
      const endpoint = `${wordpressBaseUrl.replace(/\/$/, '')}/${resource}?per_page=100&page=${page}&_fields=link,status`
      try {
        const body = await fetchText(endpoint, options)
        const parsed = JSON.parse(body) as Array<{link?: string; status?: string}>
        if (!Array.isArray(parsed) || parsed.length === 0) break
        for (const item of parsed) {
          if (item.status === 'publish' && item.link) foundUrls.add(item.link)
        }
      } catch (error) {
        if (String(error).includes('status 400') || String(error).includes('status 404')) break
        core.warning(`WordPress discovery request failed for ${endpoint}: ${String(error)}`)
        break
      }
    }
  }
  return foundUrls
}

async function crawlFromSeeds(seedUrls: string[], options: DiscoverOptions, domainAllowList: string[]): Promise<Set<string>> {
  const foundUrls = new Set<string>()
  const visited = new Set<string>()
  const queue: Array<{url: string; depth: number}> = seedUrls.map(url => ({url, depth: 0}))

  while (queue.length > 0 && foundUrls.size < options.maxUrls) {
    const current = queue.shift()!
    const normalized = normalizeUrl(current.url)
    if (!normalized || visited.has(normalized)) continue
    visited.add(normalized)

    if (!isAllowedUrl(normalized, domainAllowList, options.excludePatterns)) continue
    foundUrls.add(normalized)

    if (current.depth >= options.maxDepth) continue

    try {
      const response = await fetchWithTimeout(normalized, options)
      if (!response.ok) continue
      const contentType = response.headers.get('content-type') || ''
      if (!contentType.includes('text/html')) continue
      const html = await response.text()
      const links = extractLinksFromHtml(html, normalized)
      for (const link of links) {
        const normalizedLink = normalizeUrl(link)
        if (!normalizedLink) continue
        if (!isAllowedUrl(normalizedLink, domainAllowList, options.excludePatterns)) continue
        if (visited.has(normalizedLink)) continue
        queue.push({url: normalizedLink, depth: current.depth + 1})
      }
    } catch (error) {
      core.warning(`Crawl request failed for ${normalized}: ${String(error)}`)
    }
  }

  return foundUrls
}

export function normalizeUrl(rawUrl: string): string | undefined {
  try {
    const url = new URL(rawUrl)
    if (!['http:', 'https:'].includes(url.protocol)) return
    url.hash = ''
    for (const param of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid']) {
      url.searchParams.delete(param)
    }
    url.searchParams.sort()
    if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.slice(0, -1)
    }
    return url.toString()
  } catch {
    return
  }
}

export function parseSitemapLocs(xml: string): {sitemaps: string[]; urls: string[]} {
  const locRegex = /<loc>\s*([^<]+)\s*<\/loc>/gi
  const values: string[] = []
  let match: RegExpExecArray | null
  while ((match = locRegex.exec(xml)) !== null) {
    const parsed = normalizeUrl(match[1].trim())
    if (parsed) values.push(parsed)
  }

  if (/<sitemapindex/i.test(xml)) {
    return {sitemaps: values, urls: []}
  }
  return {sitemaps: [], urls: values}
}

export function extractLinksFromHtml(html: string, baseUrl: string): string[] {
  const links = new Set<string>()
  const hrefRegex = /href\s*=\s*["']([^"']+)["']/gi
  let match: RegExpExecArray | null
  while ((match = hrefRegex.exec(html)) !== null) {
    const href = match[1].trim()
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) {
      continue
    }
    try {
      const absolute = new URL(href, baseUrl).toString()
      links.add(absolute)
    } catch {
      continue
    }
  }
  return [...links]
}

export function collectUrlCandidates(value: unknown): string[] {
  const urls = new Set<string>()
  collectRecursive(value, urls)
  return [...urls]
}

function collectRecursive(value: unknown, out: Set<string>) {
  if (typeof value === 'string') {
    const maybeUrl = normalizeMaybeRelativeUrl(value)
    if (maybeUrl) out.add(maybeUrl)
    return
  }
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value)) {
    for (const entry of value) collectRecursive(entry, out)
    return
  }
  for (const [key, nested] of Object.entries(value)) {
    if (typeof nested === 'string' && ['url', 'uri', 'href', 'path', 'alias', 'link'].includes(key.toLowerCase())) {
      const maybeUrl = normalizeMaybeRelativeUrl(nested)
      if (maybeUrl) out.add(maybeUrl)
    } else {
      collectRecursive(nested, out)
    }
  }
}

function normalizeMaybeRelativeUrl(value: string): string | undefined {
  const trimmed = value.trim()
  if (!trimmed) return
  if (trimmed.startsWith('/')) return trimmed
  return normalizeUrl(trimmed)
}

function parseExcludePatterns(patterns: string[]): RegExp[] {
  return patterns.map(pattern => {
    try {
      return new RegExp(pattern, 'i')
    } catch {
      throw new Error(`Invalid regex in 'exclude_url_patterns': ${pattern}`)
    }
  })
}

function parsePositiveInt(input: string, name: string): number {
  const value = Number.parseInt(input, 10)
  if (!Number.isFinite(value) || value <= 0) throw new Error(`'${name}' must be a positive integer.`)
  return value
}

function parseBoolean(input: string, name: string): boolean {
  if (input === 'true') return true
  if (input === 'false') return false
  throw new Error(`'${name}' must be 'true' or 'false'.`)
}

function emptyToUndefined(value: string): string | undefined {
  return value.length === 0 ? undefined : value
}

function safeHostname(url: string): string | undefined {
  try {
    return new URL(url).hostname
  } catch {
    return
  }
}

function isAllowedUrl(url: string, domainAllowList: string[], excludePatterns: RegExp[]): boolean {
  if (domainAllowList.length > 0) {
    const hostname = new URL(url).hostname.toLowerCase()
    const allowed = domainAllowList.some(domain => hostname === domain || hostname.endsWith(`.${domain}`))
    if (!allowed) return false
  }
  return !excludePatterns.some(regex => regex.test(url))
}

async function fetchText(url: string, options: DiscoverOptions): Promise<string> {
  const response = await fetchWithTimeout(url, options)
  if (!response.ok) throw new Error(`HTTP status ${response.status}`)
  return response.text()
}

async function fetchWithTimeout(url: string, options: DiscoverOptions): Promise<Response> {
  return fetch(url, {
    method: 'GET',
    headers: {'user-agent': options.userAgent},
    signal: AbortSignal.timeout(options.requestTimeoutMs),
  })
}
