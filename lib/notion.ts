import {
  type ExtendedRecordMap,
  type SearchParams,
  type SearchResults
} from 'notion-types'
import { getBlockValue } from 'notion-utils'
import pMemoize from 'p-memoize'

import {
  isPreviewImageSupportEnabled,
  rootNotionPageId
} from './config'

// Limit the daily digest gallery on the homepage to N most recent posts
const digestDatabaseId = process.env.DIGEST_DATABASE_ID || ''
const digestCollectionLimit = 4
import { getTweetsMap } from './get-tweets'
import { notion } from './notion-api'
import { getPreviewImageMap } from './preview-images'

export async function getPage(pageId: string): Promise<ExtendedRecordMap> {
  let recordMap = await notion.getPage(pageId)

  if (isPreviewImageSupportEnabled) {
    const previewImageMap = await getPreviewImageMap(recordMap)
    ;(recordMap as any).preview_images = previewImageMap
  }

  await getTweetsMap(recordMap)

  // Filter non-public pages from collection views (gallery/table on homepage)
  filterNonPublicPages(recordMap)

  // Cap the daily digest gallery on the homepage only
  const normalizedPageId = pageId.replace(/-/g, '')
  if (normalizedPageId === rootNotionPageId) {
    limitDigestCollection(recordMap)
  }

  return recordMap
}

/**
 * Removes pages where the "Public" checkbox is unchecked from all
 * collection_query results so they don't render in gallery/table views.
 */
function filterNonPublicPages(recordMap: ExtendedRecordMap): void {
  const collectionQuery = recordMap.collection_query
  if (!collectionQuery) return

  for (const collectionId of Object.keys(collectionQuery)) {
    // Find the "Public" property ID from the collection schema
    const collection = getBlockValue(recordMap.collection?.[collectionId])
    if (!collection?.schema) continue

    const publicPropId = Object.keys(collection.schema).find(
      (key) =>
        collection.schema[key]?.name === 'Public' &&
        collection.schema[key]?.type === 'checkbox'
    )
    if (!publicPropId) continue

    // Check if a block's "Public" property is "Yes"
    const isPublic = (blockId: string): boolean => {
      const block = getBlockValue(recordMap.block[blockId])
      const val = block?.properties?.[publicPropId]
      return val?.[0]?.[0] === 'Yes'
    }

    for (const viewId of Object.keys(collectionQuery[collectionId]!)) {
      const data = collectionQuery[collectionId]![viewId] as any
      if (!data) continue

      // Filter flat blockIds
      if (data.blockIds) {
        data.blockIds = data.blockIds.filter(isPublic)
      }

      // Filter grouped results (board/gallery)
      if (data.collection_group_results?.blockIds) {
        data.collection_group_results.blockIds =
          data.collection_group_results.blockIds.filter(isPublic)
      }

      // Filter per-group results (board columns)
      if (data.groupResults) {
        for (const group of data.groupResults) {
          if (group.blockIds) {
            group.blockIds = group.blockIds.filter(isPublic)
          }
        }
      }
    }
  }
}

export async function search(params: SearchParams): Promise<SearchResults> {
  return notion.search(params)
}

/**
 * Limits the daily digest collection to show only the most recent N posts.
 * Matches the collection by checking if its parent_id corresponds to the
 * digest database page ID.
 */
function limitDigestCollection(recordMap: ExtendedRecordMap): void {
  const collectionQuery = recordMap.collection_query
  if (!collectionQuery) return

  for (const collectionId of Object.keys(collectionQuery)) {
    const collection = getBlockValue(recordMap.collection?.[collectionId])
    if (!collection) continue

    // Match digest collection by parent_id (the database page ID)
    const parentId = (collection as any).parent_id?.replace(/-/g, '')
    if (parentId !== digestDatabaseId) continue

    for (const viewId of Object.keys(collectionQuery[collectionId]!)) {
      const data = collectionQuery[collectionId]![viewId] as any
      if (!data) continue

      if (data.blockIds) {
        data.blockIds = data.blockIds.slice(0, digestCollectionLimit)
      }
      if (data.collection_group_results?.blockIds) {
        data.collection_group_results.blockIds =
          data.collection_group_results.blockIds.slice(0, digestCollectionLimit)
      }
    }
  }
}
