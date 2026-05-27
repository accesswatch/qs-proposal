import fs from 'node:fs'
import path from 'node:path'

const sourcePath = process.argv[2]
const outputDir = process.argv[3] || path.join('scan-input', 'quickstart-sitemap')
const chunkSize = Number.parseInt(process.argv[4] || '40', 10)

if (!sourcePath) {
  throw new Error('Usage: node scripts/build-quickstart-sitemap-input.mjs <sitemap-xml-path> [output-dir] [chunk-size]')
}
if (!Number.isFinite(chunkSize) || chunkSize <= 0) {
  throw new Error('chunk-size must be a positive integer')
}

const raw = fs.readFileSync(sourcePath, 'utf8')
const locMatches = [...raw.matchAll(/<loc>(.*?)<\/loc>/gims)]
const urls = locMatches.map(match => match[1].trim()).filter(Boolean)

const quickstartUrls = [...new Set(urls)]
  .filter(url => /^https:\/\/quickstart\.arizona\.edu/i.test(url))
  .sort((a, b) => a.localeCompare(b))

fs.mkdirSync(outputDir, {recursive: true})
const chunkFiles = []
for (let i = 0; i < quickstartUrls.length; i += chunkSize) {
  const chunk = quickstartUrls.slice(i, i + chunkSize).map(url => ({url}))
  const index = String(Math.floor(i / chunkSize) + 1).padStart(3, '0')
  const fileName = `chunk-${index}.json`
  const fullPath = path.join(outputDir, fileName)
  fs.writeFileSync(fullPath, JSON.stringify(chunk))
  chunkFiles.push(fileName)
}

const manifest = {
  generatedAt: new Date().toISOString(),
  sourcePath,
  chunkSize,
  totalUrls: quickstartUrls.length,
  chunkCount: chunkFiles.length,
  chunks: chunkFiles,
}

fs.writeFileSync(path.join(outputDir, 'chunks.json'), JSON.stringify(manifest, null, 2))
fs.writeFileSync(path.join(outputDir, 'urls.txt'), quickstartUrls.join('\n'))

console.log(`Built Quickstart sitemap input: ${quickstartUrls.length} URLs in ${chunkFiles.length} chunk files.`)
