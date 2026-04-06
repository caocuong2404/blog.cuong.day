import {
  getAllPagesInSpace,
  getBlockValue,
  getPageProperty,
  uuidToId
} from 'notion-utils'

import type * as types from './types'
import * as config from './config'
import { includeNotionIdInUrls } from './config'
import { getCanonicalPageId } from './get-canonical-page-id'
import { notion } from './notion-api'

const uuid = !!includeNotionIdInUrls

const KV_KEY = 'sitemap:canonicalPageMap'
const KV_TTL = 86400 // 24 hours — seeded at deploy time

// Static fallback generated at build time by scripts/seed-sitemap-kv.ts
async function getStaticFallback(): Promise<types.CanonicalPageMap | null> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare')
    const { env } = await getCloudflareContext()
    const res = await env.ASSETS.fetch(
      new URL('https://assets.local/sitemap-fallback.json')
    )
    if (res.ok) {
      return (await res.json()) as types.CanonicalPageMap
    }
  } catch {
    // Static fallback not available
  }
  return null
}

export async function getSiteMap(): Promise<types.SiteMap> {
  // 1. Try Cloudflare KV (fastest path — seeded at deploy time)
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare')
    const { env } = await getCloudflareContext()
    const cached = (await env.SITEMAP_KV.get(
      KV_KEY,
      'json'
    )) as types.CanonicalPageMap | null

    if (cached) {
      console.log('getSiteMap: KV cache hit')
      return {
        site: config.site,
        pageMap: {},
        canonicalPageMap: cached
      }
    }
  } catch {
    // KV not available (local dev), fall through
  }

  // 2. Try static fallback JSON (bundled in the worker at build time)
  const fallback = await getStaticFallback()
  if (fallback) {
    console.log('getSiteMap: static fallback hit')

    // Re-seed KV from the static fallback so next request uses KV directly
    try {
      const { getCloudflareContext } = await import('@opennextjs/cloudflare')
      const { env } = await getCloudflareContext()
      await env.SITEMAP_KV.put(KV_KEY, JSON.stringify(fallback), {
        expirationTtl: KV_TTL
      })
      console.log('getSiteMap: re-seeded KV from static fallback')
    } catch {
      // KV not available, continue
    }

    return {
      site: config.site,
      pageMap: {},
      canonicalPageMap: fallback
    }
  }

  // 3. Last resort — full Notion crawl (local dev or both caches expired)
  console.warn(
    'getSiteMap: KV and static fallback both missed — falling back to full Notion crawl'
  )
  const partialSiteMap = await getAllPagesImpl(
    config.rootNotionPageId,
    config.rootNotionSpaceId ?? undefined
  )

  // Write canonicalPageMap to KV for next request
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare')
    const { env } = await getCloudflareContext()
    await env.SITEMAP_KV.put(
      KV_KEY,
      JSON.stringify(partialSiteMap.canonicalPageMap),
      { expirationTtl: KV_TTL }
    )
    console.log('getSiteMap: wrote canonicalPageMap to KV')
  } catch {
    // KV not available, continue without caching
  }

  return {
    site: config.site,
    ...partialSiteMap
  } as types.SiteMap
}

const getPage = async (pageId: string, ...args: any[]) => {
  console.log('\nnotion getPage', uuidToId(pageId))
  // Retry with exponential backoff for 429 rate limits
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await notion.getPage(pageId, ...args)
    } catch (err: any) {
      const is429 = err?.message?.includes('429') || err?.status === 429
      if (is429 && attempt < 2) {
        const delay = (attempt + 1) * 2000
        console.warn(
          `Rate limited on ${uuidToId(pageId)}, retrying in ${delay}ms...`
        )
        await new Promise((r) => setTimeout(r, delay))
        continue
      }
      throw err
    }
  }
  throw new Error(`Failed to load page ${pageId} after retries`)
}

async function getAllPagesImpl(
  rootNotionPageId: string,
  rootNotionSpaceId?: string,
  {
    maxDepth = 3
  }: {
    maxDepth?: number
  } = {}
): Promise<Partial<types.SiteMap>> {
  const pageMap = await getAllPagesInSpace(
    rootNotionPageId,
    rootNotionSpaceId,
    getPage,
    {
      concurrency: 1,
      maxDepth
    }
  )

  const canonicalPageMap = Object.keys(pageMap).reduce(
    (map: Record<string, string>, pageId: string) => {
      const recordMap = pageMap[pageId]
      if (!recordMap) {
        throw new Error(`Error loading page "${pageId}"`)
      }

      const block = getBlockValue(recordMap.block[pageId])
      if (
        !(getPageProperty<boolean | null>('Public', block!, recordMap) ?? false)
      ) {
        return map
      }

      const canonicalPageId = getCanonicalPageId(pageId, recordMap, {
        uuid
      })!

      if (map[canonicalPageId]) {
        // you can have multiple pages in different collections that have the same id
        // TODO: we may want to error if neither entry is a collection page
        console.warn('error duplicate canonical page id', {
          canonicalPageId,
          pageId,
          existingPageId: map[canonicalPageId]
        })

        return map
      } else {
        return {
          ...map,
          [canonicalPageId]: pageId
        }
      }
    },
    {}
  )

  return {
    pageMap,
    canonicalPageMap
  }
}
