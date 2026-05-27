import {describe, it, expect} from 'vitest'
import {collectUrlCandidates, extractLinksFromHtml, normalizeUrl, parseSitemapLocs} from '../src/index.js'

describe('discover helpers', () => {
  it('normalizes URLs and removes tracking params/hash', () => {
    expect(normalizeUrl('https://www.letitglow.app/path/?utm_source=test#section')).toBe(
      'https://www.letitglow.app/path',
    )
  })

  it('parses sitemap index and url set locs', () => {
    const indexXml = `
      <sitemapindex>
        <sitemap><loc>https://www.letitglow.app/sitemap-pages.xml</loc></sitemap>
      </sitemapindex>
    `
    const urlXml = `
      <urlset>
        <url><loc>https://www.letitglow.app/about</loc></url>
      </urlset>
    `

    expect(parseSitemapLocs(indexXml)).toEqual({
      sitemaps: ['https://www.letitglow.app/sitemap-pages.xml'],
      urls: [],
    })
    expect(parseSitemapLocs(urlXml)).toEqual({
      sitemaps: [],
      urls: ['https://www.letitglow.app/about'],
    })
  })

  it('extracts absolute and relative links from html', () => {
    const html = `
      <a href="/news">News</a>
      <a href="https://www.letitglow.app/contact">Contact</a>
      <a href="#fragment">skip</a>
    `
    const links = extractLinksFromHtml(html, 'https://www.letitglow.app')
    expect(links).toContain('https://www.letitglow.app/news')
    expect(links).toContain('https://www.letitglow.app/contact')
    expect(links.some(v => v.includes('#fragment'))).toBe(false)
  })

  it('collects url candidates from nested cms payloads', () => {
    const payload = {
      data: [
        {attributes: {path: '/events'}},
        {attributes: {url: 'https://www.letitglow.app/about'}},
      ],
      included: [{link: '/programs'}],
    }
    expect(collectUrlCandidates(payload).sort()).toEqual(['/events', '/programs', 'https://www.letitglow.app/about'])
  })
})
