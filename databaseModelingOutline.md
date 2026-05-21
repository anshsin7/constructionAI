# Database & Product Upload — Modeling Outline

> **Purpose:** Plan how procurement uploads (Excel, CSV, PDF contracts/quotes/pricelists) feed a **unified product catalog** that powers mobile search (camera / voice / text) with **smart matching** and **popularity-based sorting**.

You will review this document, answer the questions in **§10**, and adjust anything that does not match your business rules. Implementation follows your answers.

---

## 1. Goals (from README + product vision)

| Goal | Meaning |
|------|---------|
| **Unified catalog** | One `products` table (or clear master + links) fed by many sources — not separate silos per file |
| **Upload anything** | Contracts, quotes, price lists, Excel exports from ERP — CSV/XLSX/PDF |
| **Smart discovery** | Worker says/types/shows something → best product + **similar alternatives** surface |
| **Popularity ranking** | Items ordered more often appear **higher** in mobile results (within category and in search) |
| **Procurement control** | Upload + review on **web dashboard**; workers only consume on mobile |

**Already built today:**
- `products` table with `category`, `popularity_score`, `supplier_id`
- `popularity_score` increments on each order (backend)
- Classify endpoint returns products **filtered by AI category**, sorted by `popularity_score DESC`
- `uploaded_documents` table exists but **no upload pipeline** yet

---

## 2. Design principles

1. **Master product record** — Every orderable item resolves to one `products.id`.
2. **Traceability** — Know *where* a price/name came from (which contract, which upload, which row).
3. **Human-in-the-loop for imports** — AI proposes rows; procurement **confirms** before merge (hackathon-safe).
4. **Idempotent imports** — Re-uploading the same supplier list updates prices, does not duplicate blindly.
5. **Search = category + similarity + popularity** — Category alone is not enough for “similar items”; need a second signal (see §6).

---

## 3. Proposed data model (high level)

### 3.1 Keep / extend existing tables

**`products` (master catalog)** — extend, do not replace:

| Column | Status | Notes |
|--------|--------|-------|
| `id` | exists | PK |
| `name` | exists | Display name (canonical) |
| `category` | exists | Must stay aligned with mobile AI taxonomy (PPE, Fasteners, …) |
| `description` | exists | Optional; helps AI matching |
| `unit` | exists | piece, box, kg, m, … |
| `unit_price` | exists | **Which price wins** if multiple sources? → see Q3 |
| `supplier_id` | exists | FK → `suppliers` |
| `popularity_score` | exists | Increment on order; used for `ORDER BY` on mobile |
| `image_url` | exists | Optional |
| **NEW `sku`** | proposed | Supplier / internal article number for dedup |
| **NEW `is_active`** | proposed | Soft-disable without deleting history |
| **NEW `search_text`** | proposed | Generated: name + aliases + keywords for full-text search |
| **NEW `embedding`** | optional | vector(1536) for semantic “similar products” — only if we enable pgvector |

**`suppliers`** — extend:

| Column | Status | Notes |
|--------|--------|-------|
| `contract_ref` | exists | Could link to `contracts` table instead |

---

### 3.2 New tables (recommended)

#### `product_sources` — logical origin of catalog data

Tracks *why* a product exists (contract vs ad-hoc list), not each file row.

```sql
product_sources (
  id uuid PK,
  type text,  -- 'contract' | 'price_list' | 'quote' | 'manual'
  supplier_id uuid FK,
  name text,  -- e.g. "BauSupply Frame Agreement 2024"
  valid_from date,
  valid_to date,
  site_id uuid NULL,  -- NULL = all sites
  created_at timestamptz
)
```

#### `catalog_uploads` — one row per file upload (replaces loose use of `uploaded_documents`)

```sql
catalog_uploads (
  id uuid PK,
  file_name text,
  file_url text,           -- Supabase Storage path
  file_type text,          -- csv | xlsx | pdf
  source_id uuid FK → product_sources,
  status text,             -- 'pending' | 'parsed' | 'preview' | 'committed' | 'failed'
  uploaded_by uuid FK → users,
  row_count integer,
  error_message text,
  created_at timestamptz,
  committed_at timestamptz
)
```

#### `catalog_upload_rows` — staging / preview (AI extraction output)

Holds parsed lines **before** they become `products`. User edits/rejects rows in web UI.

```sql
catalog_upload_rows (
  id uuid PK,
  upload_id uuid FK → catalog_uploads,
  row_index integer,
  raw_json jsonb,          -- original cells / AI chunk
  name text,
  category text,
  unit text,
  unit_price numeric,
  supplier_name text,
  sku text,
  match_product_id uuid NULL,  -- if AI thinks this updates existing product
  action text,             -- 'create' | 'update' | 'skip' | 'duplicate'
  confidence text,         -- high | medium | low
  committed boolean default false
)
```

#### `product_aliases` — alternate names for matching

Critical for voice/text (“Schrauben” vs “Concrete Screw 7.5x92”) and for import variants.

```sql
product_aliases (
  id uuid PK,
  product_id uuid FK → products,
  alias text NOT NULL,
  source text,             -- 'import' | 'ai' | 'manual'
  created_at timestamptz
)
```

#### `product_price_history` (optional but useful for audit)

```sql
product_price_history (
  id uuid PK,
  product_id uuid FK,
  unit_price numeric,
  source_id uuid FK,
  upload_id uuid FK,
  effective_from timestamptz
)
```

**Relation to existing `uploaded_documents`:**  
Migrate concept → `catalog_uploads` (richer) or keep `uploaded_documents` as alias/view. **Recommendation:** use `catalog_uploads` going forward; deprecate `uploaded_documents` in new code.

---

## 4. Entity relationship (ASCII)

```
suppliers ─────┬───── product_sources ───── catalog_uploads
               │                                      │
               │                                      ├── catalog_upload_rows (staging)
               │                                      │
               └───── products ◄──── product_aliases
                         │
                         ├── product_price_history (optional)
                         │
                         └── orders (increments popularity_score)
```

---

## 5. Upload & import flow (end-to-end)

### 5.1 Web UI (`/upload` on procurement dashboard)

1. User selects **source type** (contract / price list / quote) + supplier (+ optional site).
2. Drag-drop **CSV, XLSX, or PDF**.
3. Backend stores file in Storage → creates `catalog_uploads` (`status = pending`).

### 5.2 Parse

| File type | Parser |
|-----------|--------|
| **CSV** | Column mapping (header detection) + optional AI cleanup |
| **XLSX** | Sheet selection + same as CSV |
| **PDF** | Text extraction → GPT structured extraction (chunked if long) |

AI prompt output per row (aligned with OUTLINE):

```json
{
  "name": "string",
  "category": "one of preset categories",
  "unit": "piece|box|kg|m|...",
  "unit_price": number | null,
  "supplier_name": "string | null",
  "sku": "string | null",
  "confidence": "high|medium|low"
}
```

Rows land in `catalog_upload_rows` → `catalog_uploads.status = preview`.

### 5.3 Preview & commit (human)

Procurement sees table:
- Proposed **create / update / skip**
- AI-suggested **match** to existing `products.id` (dedup by SKU, fuzzy name, same supplier)
- Editable category & price

On **Commit**:
1. Upsert `suppliers` if new names appear.
2. Insert/update `products` (set `search_text`, refresh `product_aliases`).
3. Record `product_price_history` if used.
4. Mark upload `committed`; rows `committed = true`.

### 5.4 Deduplication rules (proposal)

Match priority:
1. Same `supplier_id` + exact `sku`
2. Same `supplier_id` + high fuzzy name similarity (>0.9)
3. Else → **create** new product

On **update**: only overwrite `unit_price` / `name` if source is newer or user explicitly confirms (see Q3).

---

## 6. Smart categorization & “similar items” on mobile

Today: **Step A** = GPT picks one `category` → **Step B** = SQL `WHERE category = ? ORDER BY popularity_score DESC`.

**Gaps:**
- Wrong category → user never sees right product.
- User wants **alternatives** (“similar items”), not only same category.
- Free-text query should find products **by name/alias**, not only via category.

### 6.1 Proposed search pipeline (after upload system is rich)

```
Input (image | voice→text | text)
        │
        ▼
┌───────────────────┐
│ AI: category +    │  → matched_product_name, keywords, confidence
│ keywords + intent │
└─────────┬─────────┘
          │
          ├─► Path A: category filter (current)
          │
          ├─► Path B: full-text / fuzzy on products.search_text + product_aliases
          │
          └─► Path C (optional): embedding similarity top-K
          │
          ▼
    Merge & rank scores:
      final_score = w1 * text_similarity
                  + w2 * category_match
                  + w3 * normalized_popularity
          │
          ▼
    Return ordered list to mobile (top N, e.g. 20)
```

**Popularity (§7)** is the **sort key within** merged results, not the only signal.

### 6.2 “Similar items” definition

| Level | Behavior |
|-------|----------|
| **Strict** | Same category + high text similarity |
| **Medium** | Same category OR same supplier + related keywords |
| **Loose** | Embedding neighbors (if pgvector enabled) |

**Proposal for hackathon:** Path A + B + popularity (no pgvector unless you want it — see Q6).

---

## 7. Popularity model

### 7.1 Current behavior

- `popularity_score` integer on `products`, default 0.
- Backend: `+1` on each **order created** (any status).

### 7.2 Proposed refinements (pick in §10)

| Option | Rule |
|--------|------|
| **P1 (keep simple)** | +1 per order line; sort `DESC` on mobile |
| **P2 (weighted)** | +1 on `confirmed` only; +0.5 on `approved` / `po_sent` |
| **P3 (time decay)** | Store `order_count_30d` via periodic rollup; fresher demand ranks higher |
| **P4 (site-specific)** | `product_site_stats(site_id, product_id, order_count)` — popular at Zürich HB ≠ Basel |

**Display rule on mobile (unchanged UX):**  
Results sorted by `popularity_score DESC` (or site-specific score if P4).

**Optional analytics:** Procurement dashboard catalog page shows popularity + last ordered date.

---

## 8. Category taxonomy (must stay consistent)

Mobile + imports must use the **same** category list:

`PPE`, `Power Tools`, `Fasteners`, `Concrete & Masonry`, `Lumber & Wood`, `Electrical`, `Plumbing`, `Hand Tools`, `Other`

Import AI must **map** supplier categories → this list (never invent new values without admin mapping table).

**Optional table `category_mappings`:**

```sql
category_mappings (
  external_label text,  -- e.g. "Befestigungstechnik"
  category text         -- → 'Fasteners'
)
```

---

## 9. API sketch (to implement after you approve model)

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/catalog/upload` | multipart file + metadata → `catalog_uploads` |
| POST | `/api/catalog/upload/:id/parse` | run parsers + AI → `catalog_upload_rows` |
| GET | `/api/catalog/upload/:id/preview` | staging rows for web UI |
| PATCH | `/api/catalog/upload/:id/rows/:rowId` | edit one staging row |
| POST | `/api/catalog/upload/:id/commit` | merge into `products` |
| GET | `/api/products` | extend: `?search=&category=&sort=popularity` |
| POST | `/api/classify` | extend response: `products` + `similar_products` + match scores |

Storage bucket: `catalog-uploads` (raw files), keep `po-documents` separate.

---

## 10. Questions for you (please answer inline)

> Edit this section directly, or reply in chat and we will merge answers here.

### Q1 — Catalog scope

Are products **global** (all sites share one catalog) or **per-site** (each construction site has its own allowed products/prices)?

**Your answer:**
All sites share one catalog.
```
[e.g. global catalog / per-site overrides / hybrid: global product but site-specific price]
```

---

### Q2 — Source types & priority

Which upload types do you need in v1?

- [x] Framework **contracts** (PDF)
- [x] **Price lists** (Excel/CSV)
- [x] One-off **quotes**
- [ ] Other: ___________

When the same SKU appears in two uploads with different prices, which wins?

**Your answer:**
see xs above
```
[e.g. latest upload wins / contract beats price list / manual lock]
```

---

### Q3 — Price & unit rules

- Can `unit_price` be **null** for some imports (name only, price later)?
- Do you need **multiple units** per product (e.g. sell per piece and per box)?
- Currency always **CHF**?

**Your answer:**
price is needed otherwise don't add it to the database. Currency can be just CHF. This is much simpler for now as it's only a hackathon. If it's usd in the file just do chf and convert the price at current daily rate. Afterwards that price is logged and doesnt change anymore.
Just unit for simplicity again.
```

```

---

### Q4 — Identity & deduplication

What uniquely identifies a product in your world?

- [ ] Supplier + **SKU / article number** (preferred technically)
- [ ] Supplier + **exact product name**
- [ ] Internal ID only (you assign)

Should similar names **merge** automatically or always show as separate until procurement merges?

**Your answer:**

```
The AI should decide whether two products are the same. It should also create all of the data for the database based on the input. If price is not avaiable just ignore the file and state some items didn't have a price.
By the way!: Categories / keywords should also be created by AI. For it to then search efficiently in the app and display what is really needed.
```

---

### Q5 — PDF / contract complexity

For PDF contracts, is **full product table extraction** required, or only products referenced in a specific section / appendix?

Max file size / page count to support in hackathon?

**Your answer:**

```
it's gonna be like 5 pages max for the pdfs. It really shouldn't be too complicated. If 15 is also fine do 15. But don't overcomplicate it. Output file too big or something if its more than 15 pages.
```

---

### Q6 — “Similar items” on mobile

How should “similar” behave?

- [ ] **A)** Same category only, sorted by popularity (current + better text match within category)
- [ ] **B)** Same category first, then fill with fuzzy name matches from other categories
- [ ] **C)** Semantic embeddings (extra Supabase pgvector setup)

How many results max on the results screen? (e.g. 10 / 20 / 50)

**Your answer:**

```
50 results sounds reasonable. Also make it find out what size screw we are looking at or talking about. Do a really context based search and hence save items with keywords/categories/tags
```

---

### Q7 — Popularity

Which popularity option from §7.2? (P1 / P2 / P3 / P4)

Should ordering a product **once** be enough to boost it, or only **confirmed** orders?

**Your answer:**

```
keep it simple. if a product is ordered one more time increase the count by one or so.
```

---

### Q8 — Who can upload & approve imports

Only `role = procurement`? Any **approval workflow** for imports (second person reviews)?

**Your answer:**

```
Procurement will be the ones uploading documents.
```

---

### Q9 — Data retention

Keep all `catalog_upload_rows` forever for audit, or delete after commit?

Keep raw files in Storage forever?

**Your answer:**

```
No just save it in the database using AI and then delete. Of course give a quick view to procurement so that they see what they just uploaded into the database. (don't show keywords or non relevant stuff of course) - only price sku, supplier and other important information
```

---

### Q10 — Languages & naming

Product names / aliases in **German**, **English**, or both?

Example: worker says “Schrauben” — should match “Concrete Screw” via alias table?

**Your answer:**

```
The aliases should only be in english but the ai searching should also understand other languages of course and based on that give some keywords for the display of items
```

---

### Q11 — Inactive / discontinued products

If a product disappears from a new price list upload, should it be:

- [x] Set `is_active = false`
- [ ] Left active until manual retire
- [ ] Deleted (not recommended — breaks order history)

**Your answer:**

```
is_active = false
```

---

### Q12 — Anything else?

Contracts linked to **sites**? Multiple suppliers per product? Minimum order quantities? Lead times? Store in DB or ignore for v1?

**Your answer:**

```
No just one supplier. all products for all sites. no lead times or quantities.
```

---

## 11. Suggested implementation order (after your answers)

1. Schema migration SQL (`catalog_*`, `product_aliases`, optional columns on `products`)
2. `POST /api/catalog/upload` + CSV/XLSX parse (no PDF first if tight on time)
3. Web `/upload` preview + commit UI
4. Improve `POST /api/classify` merge ranking (text + category + popularity)
5. PDF extraction + `category_mappings` if needed
6. Popularity refinements (P2–P4) if requested

---

## 12. What stays unchanged (short term)

- Order / approval / PO flow — still uses `products.id`
- Existing seed products remain valid
- Mobile three-button UX — only **results ranking** improves as catalog grows

---

*Document version: 2026-05-21 — draft for review*
