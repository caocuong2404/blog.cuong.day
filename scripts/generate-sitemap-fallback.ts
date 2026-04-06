/**
 * Lightweight post-build script to generate sitemap-fallback.json.
 *
 * Queries the Notion database for all public pages with Slug property.
 * Uses 1-2 API calls (paginated, 100 per page) instead of crawling
 * every page individually (60+ calls).
 *
 * Output: public/sitemap-fallback.json (bundled into worker assets)
 */

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const DATABASES = [process.env.DIGEST_DATABASE_ID].filter(Boolean) as string[]

const NOTION_API_KEY = process.env.NOTION_API_KEY

async function queryAllPublicSlugs(): Promise<Record<string, string>> {
  if (!NOTION_API_KEY || DATABASES.length === 0) {
    console.log(
      '⚠ No NOTION_API_KEY or database IDs — skipping fallback generation'
    )
    return {}
  }

  const map: Record<string, string> = {}
  let totalCalls = 0

  for (const dbId of DATABASES) {
    let cursor: string | undefined

    do {
      const body: Record<string, unknown> = {
        filter: {
          and: [
            { property: 'Public', checkbox: { equals: true } },
            { property: 'Slug', rich_text: { is_not_empty: true } }
          ]
        },
        page_size: 100
      }
      if (cursor) body.start_cursor = cursor

      const res = await fetch(
        `https://api.notion.com/v1/databases/${dbId}/query`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${NOTION_API_KEY}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        }
      )

      totalCalls++

      if (!res.ok) {
        console.warn(`⚠ DB query failed for ${dbId}: ${res.status}`)
        break
      }

      const data = (await res.json()) as {
        results: Array<{
          id: string
          properties: {
            Slug: { rich_text: Array<{ plain_text: string }> }
          }
        }>
        has_more: boolean
        next_cursor: string | null
      }

      for (const page of data.results) {
        const slug = page.properties?.Slug?.rich_text?.[0]?.plain_text
        if (slug) {
          map[slug] = page.id.replace(/-/g, '')
        }
      }

      cursor = data.has_more ? (data.next_cursor ?? undefined) : undefined
    } while (cursor)
  }

  console.log(
    `✓ Found ${Object.keys(map).length} public pages (${totalCalls} API call${totalCalls > 1 ? 's' : ''})`
  )
  return map
}

async function main() {
  console.log('📄 Generating sitemap-fallback.json...')
  const map = await queryAllPublicSlugs()

  if (Object.keys(map).length === 0) {
    console.log('⚠ No pages found — keeping existing fallback if any')
    return
  }

  const outPath = join(__dirname, '..', 'public', 'sitemap-fallback.json')
  writeFileSync(outPath, JSON.stringify(map, null, 2))
  console.log(`✓ Written ${outPath} (${Object.keys(map).length} entries)`)
}

main().catch((err) => {
  console.error('❌ Fallback generation failed:', err)
  // Non-fatal — build continues without fresh fallback
})
