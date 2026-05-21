function tokenize(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9x.\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1)
}

function overlapScore(tokens, haystack) {
  if (!tokens.length) return 0
  const set = new Set(tokenize(haystack))
  let hits = 0
  for (const t of tokens) if (set.has(t) || [...set].some((s) => s.includes(t) || t.includes(s))) hits++
  return hits / tokens.length
}

function buildSearchBlob(p) {
  const kw = Array.isArray(p.keywords) ? p.keywords.join(' ') : ''
  const aliases = (p.product_aliases ?? [])
    .map((a) => (typeof a === 'string' ? a : a.alias))
    .join(' ')
  return [
    p.name,
    p.description,
    p.category,
    p.size_spec,
    p.search_text,
    kw,
    aliases
  ]
    .filter(Boolean)
    .join(' ')
}

/**
 * Rank active products for mobile classify (max 50).
 */
export function rankProducts(products, classification, limit = 50) {
  const queryTokens = tokenize(
    [
      classification.matched_product_name,
      classification.search_query,
      classification.size_spec,
      ...(classification.keywords ?? [])
    ]
      .filter(Boolean)
      .join(' ')
  )

  const category = classification.category

  const scored = products
    .filter((p) => p.is_active !== false)
    .map((p) => {
      const blob = buildSearchBlob(p)
      let score = 0

      if (p.category === category) score += 40
      else if (category && category !== 'Other') score += 5

      score += overlapScore(queryTokens, blob) * 35

      if (classification.matched_product_name) {
        const nameLower = p.name.toLowerCase()
        const matchLower = classification.matched_product_name.toLowerCase()
        if (nameLower === matchLower) score += 30
        else if (nameLower.includes(matchLower) || matchLower.includes(nameLower)) score += 18
      }

      if (classification.size_spec && p.size_spec) {
        const spec = classification.size_spec.toLowerCase()
        const ps = p.size_spec.toLowerCase()
        if (ps.includes(spec) || spec.includes(ps)) score += 15
      }

      score += Math.min(25, (p.popularity_score ?? 0) * 0.5)

      return { ...p, _score: score }
    })
    .sort((a, b) => b._score - a._score || (b.popularity_score ?? 0) - (a.popularity_score ?? 0))

  return scored.slice(0, limit).map(({ _score, ...p }) => p)
}

export function buildSearchText({ name, description, category, keywords, aliases, size_spec }) {
  const kw = Array.isArray(keywords) ? keywords.join(' ') : ''
  const al = Array.isArray(aliases) ? aliases.join(' ') : ''
  return [name, description, category, size_spec, kw, al]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .trim()
}
