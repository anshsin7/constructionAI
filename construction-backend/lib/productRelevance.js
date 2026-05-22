import { rankProducts } from './productSearch.js'

export const RELEVANCE_MIN_PERCENT = Number(process.env.RELEVANCE_MIN_PERCENT) || 50
const CANDIDATE_LIMIT = Number(process.env.RELEVANCE_CANDIDATE_LIMIT) || 28
const DISPLAY_LIMIT = Number(process.env.RELEVANCE_DISPLAY_LIMIT) || 15

function parseRelevanceJson(raw) {
  const trimmed = raw.trim().replace(/^```json?\s*/i, '').replace(/\s*```$/, '')
  return JSON.parse(trimmed)
}

function heuristicRelevanceFallback(products, classification) {
  const rescored = rankProducts(products, classification, CANDIDATE_LIMIT)
  const n = rescored.length || 1
  return rescored
    .map((p, i) => ({
      ...p,
      relevance_percent: Math.min(100, Math.round(100 - (i / n) * 45))
    }))
    .filter((p) => p.relevance_percent >= RELEVANCE_MIN_PERCENT)
    .slice(0, DISPLAY_LIMIT)
}

/**
 * AI relevance % for display only (not persisted). Filters catalog candidates.
 */
export async function filterProductsByAiRelevance(openai, classification, catalogProducts) {
  const candidates = rankProducts(catalogProducts, classification, CANDIDATE_LIMIT)
  if (!candidates.length) return []

  const compact = candidates.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    unit: p.unit,
    size_spec: p.size_spec ?? null
  }))

  const context = {
    category: classification.category,
    matched_product_name: classification.matched_product_name,
    search_query: classification.search_query,
    keywords: classification.keywords ?? [],
    size_spec: classification.size_spec,
    reasoning: classification.reasoning
  }

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.RELEVANCE_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You score how well each catalog product matches a construction site order.
Be strict: 0–30 unrelated, 40–55 weak, 60–75 plausible, 80–100 strong match.
Return JSON only.`
        },
        {
          role: 'user',
          content: `Worker request:\n${JSON.stringify(context)}\n\nCatalog (score every id 0-100):\n${JSON.stringify(compact)}\n\nReturn ONLY:\n{"items":[{"id":"<uuid>","relevance":<0-100>},...]}`
        }
      ],
      max_tokens: 1500,
      temperature: 0.1
    })

    const parsed = parseRelevanceJson(completion.choices[0].message.content)
    const rows = parsed.items ?? parsed.scores ?? parsed.products ?? []
    const byId = Object.fromEntries(
      rows.map((row) => [
        row.id,
        Math.min(100, Math.max(0, Math.round(Number(row.relevance ?? row.relevance_percent ?? 0))))
      ])
    )

    const scored = candidates
      .map((p) => ({
        ...p,
        relevance_percent: byId[p.id] ?? 0
      }))
      .filter((p) => p.relevance_percent >= RELEVANCE_MIN_PERCENT)
      .sort((a, b) => b.relevance_percent - a.relevance_percent)
      .slice(0, DISPLAY_LIMIT)

    if (scored.length > 0) return scored

    console.warn('[Relevance] AI returned no items above threshold; using heuristic fallback')
    return heuristicRelevanceFallback(catalogProducts, classification)
  } catch (err) {
    console.error('[Relevance] AI scoring failed:', err.message)
    return heuristicRelevanceFallback(catalogProducts, classification)
  }
}
