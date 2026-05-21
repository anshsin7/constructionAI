export const CATEGORIES = [
  'PPE',
  'Power Tools',
  'Fasteners',
  'Concrete & Masonry',
  'Lumber & Wood',
  'Electrical',
  'Plumbing',
  'Hand Tools',
  'Other'
]

export function normalizeCategory(raw) {
  if (!raw) return 'Other'
  const hit = CATEGORIES.find((c) => c.toLowerCase() === String(raw).trim().toLowerCase())
  if (hit) return hit
  const lower = String(raw).toLowerCase()
  if (/ppe|helmet|goggle|safety|glove/i.test(lower)) return 'PPE'
  if (/drill|saw|grinder|power/i.test(lower)) return 'Power Tools'
  if (/screw|bolt|anchor|fastener|nail/i.test(lower)) return 'Fasteners'
  if (/concrete|masonry|cement/i.test(lower)) return 'Concrete & Masonry'
  if (/lumber|wood|timber/i.test(lower)) return 'Lumber & Wood'
  if (/electric|cable|wire/i.test(lower)) return 'Electrical'
  if (/plumb|pipe/i.test(lower)) return 'Plumbing'
  if (/hammer|wrench|hand/i.test(lower)) return 'Hand Tools'
  return 'Other'
}
