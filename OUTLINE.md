# AI Construction Companion — Project Outline
> Hackathon Build Guide · 24h Sprint · Full-Stack AI-Powered Procurement System

---

## 1. Project Vision

A mobile-first, AI-powered procurement assistant for construction sites. Workers in the field can request materials using their camera, voice, or text. The system classifies their need using AI, matches it to contracted products, routes the order through an approval hierarchy, auto-generates a signed PO, dispatches it to the supplier, and confirms back to the worker — all without manual procurement involvement.

The companion web dashboard gives procurement teams a real-time view of spending across all sites, supplier relationships, and budget control per employee.

---

## 2. Core Principles for the AI Building This

- **Simplicity over perfection**: This is a hackathon. Prefer working features over polished edge cases.
- **AI-first**: All classification, matching, and document generation goes through the Claude API. Do not build custom ML.
- **Shared backend**: Both the mobile app and web app talk to the same Supabase backend.
- **Mobile UX must be glove-friendly**: Large buttons, minimal text input required, high contrast.
- **Procurement UX must be data-dense but clean**: Think enterprise dashboard, not consumer app.

---

## 3. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Mobile App | React Native + Expo | Shared logic with web, faster than native Swift for this timeline |
| Web App | React + Vite + TailwindCSS | Procurement dashboard |
| Backend / DB | Supabase | Postgres + Auth + Realtime + Storage |
| AI | Anthropic Claude API (claude-sonnet-4-20250514) | Image, voice transcript, and text classification |
| Voice Transcription | Expo Audio + Whisper API or device STT | Transcribe on-device or via OpenAI Whisper |
| PDF Generation | pdf-lib (npm) | PO document creation |
| Email / Supplier Comms | Resend or Supabase Edge Functions + nodemailer | Send PO to supplier |
| Notifications | Supabase Realtime | Push state changes to app in real time |

---

## 4. Database Schema

### `users`
```sql
id uuid primary key
name text
email text
role text -- 'worker' | 'approver' | 'procurement'
site_id uuid references sites(id)
budget_limit numeric -- max order value before approval required
manager_id uuid references users(id) -- who approves their requests
created_at timestamp
```

### `sites`
```sql
id uuid primary key
name text
location text
total_budget numeric
spent numeric default 0
created_at timestamp
```

### `suppliers`
```sql
id uuid primary key
name text
email text
contract_ref text
created_at timestamp
```

### `products`
```sql
id uuid primary key
name text
category text -- 'Safety Equipment' | 'Power Tools' | 'Fasteners' | 'Concrete & Masonry' | 'Lumber & Wood' | 'Electrical' | 'Plumbing' | 'Hand Tools' | 'PPE' | 'Other'
description text
unit text -- 'piece' | 'box' | 'kg' | 'm' | etc.
unit_price numeric
supplier_id uuid references suppliers(id)
popularity_score integer default 0 -- incremented on each order
image_url text
created_at timestamp
```

### `orders`
```sql
id uuid primary key
requestor_id uuid references users(id)
product_id uuid references products(id)
quantity integer
total_price numeric
status text -- 'pending_approval' | 'approved' | 'rejected' | 'po_sent' | 'confirmed' | 'cancelled'
approver_id uuid references users(id)
approval_note text
site_id uuid references sites(id)
input_method text -- 'image' | 'voice' | 'text'
ai_classification jsonb -- store what the AI returned for debugging
po_pdf_url text -- storage URL of generated PO
created_at timestamp
updated_at timestamp
```

### `uploaded_documents`
```sql
id uuid primary key
file_name text
file_url text
file_type text -- 'csv' | 'xlsx' | 'pdf'
processed boolean default false
uploaded_by uuid references users(id)
created_at timestamp
```

---

## 5. Mobile App — Screen Flow

### Entry Screen
- Three large buttons, full-width, high contrast:
  - 📷 **Camera** — take photo of item or situation
  - 🎤 **Microphone** — say what you need
  - ⌨️ **Text** — type what you need
- Bottom: small icon to view "My Orders" history

---

### AI Classification Flow (all three paths converge here)

**Image path:**
1. User taps Camera → native camera opens
2. Photo is taken → base64 encoded
3. POST to `/api/classify` with `{ type: 'image', data: base64 }`
4. Claude prompt:
```
You are a construction site procurement assistant.
Analyze this image and identify what construction product or material is shown or needed.
Return ONLY valid JSON in this format:
{
  "category": "<one of the preset categories>",
  "matched_product_name": "<best guess at specific product name or null>",
  "confidence": "<high|medium|low>",
  "reasoning": "<one sentence>"
}
Preset categories: Safety Equipment, Power Tools, Fasteners, Concrete & Masonry, Lumber & Wood, Electrical, Plumbing, Hand Tools, PPE, Other
```

**Voice path:**
1. User taps Microphone → record audio
2. Send audio to Whisper API (or use Expo device STT) → get transcript
3. Send transcript as text to same Claude classification endpoint

**Text path:**
1. User types query
2. Send directly to Claude classification endpoint

**All paths:** Claude returns `{ category, matched_product_name, confidence }` → query Supabase `products` table filtered by category, ordered by `popularity_score DESC` → display results

---

### Product Results Screen
- List of products in large cards (glove-friendly):
  - Product name (large font)
  - Unit price
  - Supplier name
  - Quantity selector (+ / − buttons, large)
- "Order" button at bottom (large, full-width, green)

---

### Order / Approval Logic
```
if (order.total_price <= user.budget_limit):
    → order goes directly to approved state
    → PO is generated and sent
else:
    → order status = 'pending_approval'
    → push notification sent to user.manager_id
    → Approval Request Screen shown to approver
```

**Approver screen:**
- Who is requesting (name, site, role)
- What they need (product, quantity, price)
- "Approve" (green) / "Reject" (red) buttons with optional note
- On approve: status → 'approved', trigger PO generation
- On reject: status → 'rejected', push notification to requestor

**Requestor confirmation:**
- Pending: "Your order is awaiting approval from [Manager Name]"
- Rejected: "Your order was not approved. Note: [note]"
- Approved / PO sent: "Order confirmed. PO has been sent to [Supplier]."
- Supplier confirmed: "✅ [Supplier] has confirmed your order for [Product]."

---

### My Orders Screen
- List of past orders with status badges
- Tap to expand: full details, PO PDF download link

---

## 6. Web App — Procurement Dashboard

### Overview Page (`/`)
- Header: site selector dropdown (or "All Sites")
- Grid of **Site Cards**, each showing:
  - Site name + location
  - Total budget vs. spent (progress bar)
  - Number of active orders
  - Click → Site Detail page

### Site Detail Page (`/sites/:id`)
- Spending breakdown by category (bar or donut chart)
- Recent orders table: Product | Requestor | Approver | Date | Status | Amount
- Employee list with their individual budget limits (editable inline)
- Export button (CSV)

### Order History Page (`/orders`)
- Full table across all sites
- Filterable by: site, status, date range, requestor, category
- Click row → order detail modal with PO PDF link

### Product Catalog Page (`/catalog`)
- Table of all products in database
- Filterable by category, supplier
- Edit popularity score, price, availability

### Data Upload Page (`/upload`)
- Drag-and-drop zone for CSV / XLSX / PDF
- Accepted file types: supplier price lists, product catalogs, contract documents
- On upload:
  1. File stored in Supabase Storage
  2. Edge Function (or backend route) parses file
  3. Claude API called to extract product rows:
  ```
  Parse this document and extract all products.
  Return JSON array: [{ name, category, unit, unit_price, supplier_name }]
  ```
  4. Products upserted into `products` table
  5. User sees preview table before confirming import

---

## 7. Backend API Routes

```
POST   /api/classify          → AI classification (image/voice/text)
GET    /api/products           → list products (filter: category, search)
POST   /api/orders             → create new order
GET    /api/orders/:id         → get order detail
PATCH  /api/orders/:id/approve → approver approves
PATCH  /api/orders/:id/reject  → approver rejects
POST   /api/orders/:id/po      → generate PO PDF and send to supplier
POST   /api/supplier/confirm   → webhook: supplier confirms PO
GET    /api/sites              → list sites with budget data
GET    /api/sites/:id          → site detail + spending breakdown
PATCH  /api/users/:id/budget   → update user budget limit
POST   /api/upload             → upload product document
```

---

## 8. PO Generation Flow

When an order is approved:
1. Pull order details from Supabase (product, quantity, price, site, requestor, supplier)
2. Use `pdf-lib` to generate a PDF with:
   - Company logo placeholder
   - PO number (auto-incremented)
   - Date
   - Ship-to address (site location)
   - Line items table
   - Total
   - Digital signature field (placeholder or auto-signed)
3. Upload PDF to Supabase Storage
4. Send email to supplier via Resend:
   - Subject: `PO #[number] from [Company] — [Site Name]`
   - Body: summary + PDF attachment
5. Update order status → `po_sent`
6. Realtime event triggers push notification to requestor

**Supplier confirmation:**
- Either a reply-email parser (simple: check for "confirmed" in reply)
- Or a simple web link in the email: `https://yourapp.com/confirm?po=[id]&token=[secret]`
- On confirmation: order status → `confirmed`, notify requestor and update site spending

---

## 9. AI Prompts Reference

### Classification Prompt (all input types)
```
You are a procurement assistant for construction sites.
A worker needs a product. Classify their request into the correct category and identify the specific product if possible.
Input type: [image|text]
Input: [base64 image OR text string]

Return ONLY valid JSON (no markdown, no explanation):
{
  "category": "<Safety Equipment|Power Tools|Fasteners|Concrete & Masonry|Lumber & Wood|Electrical|Plumbing|Hand Tools|PPE|Other>",
  "matched_product_name": "<specific product name or null if uncertain>",
  "confidence": "<high|medium|low>",
  "reasoning": "<one sentence max>"
}
```

### Document Parsing Prompt (for CSV/XLSX uploads)
```
You are a data extraction assistant. Parse the following document content and extract all product entries.
Return ONLY a valid JSON array with no markdown or explanation:
[
  {
    "name": "<product name>",
    "category": "<best matching category>",
    "unit": "<piece|box|kg|m|l|other>",
    "unit_price": <number or null>,
    "supplier_name": "<supplier name or null>"
  }
]
Document content:
[DOCUMENT TEXT HERE]
```

---

## 10. Build Order (24h Sprint)

| Time | Task | Owner Hint |
|---|---|---|
| 0:00–1:00 | Supabase project setup, schema creation, seed data (products, users, sites) | Backend |
| 1:00–2:00 | Claude API integration test — validate all 3 classification flows work | AI |
| 2:00–5:00 | Mobile: Entry screen + Camera/Voice/Text → Classification → Results screen | Mobile |
| 5:00–8:00 | Mobile: Order flow + approval logic + status screens | Mobile |
| 8:00–10:00 | Backend: Order routes, approval routes, Realtime events | Backend |
| 10:00–13:00 | PO PDF generation + Resend email to supplier + confirmation webhook | Backend |
| 13:00–16:00 | Web: Site overview cards + Site detail page + spending charts | Web |
| 16:00–18:00 | Web: Order history table + filters + order detail modal | Web |
| 18:00–20:00 | Web: Data upload page + Claude document parsing + product import | Web / AI |
| 20:00–22:00 | Integration testing end-to-end: worker orders → approver → PO → confirm | All |
| 22:00–24:00 | Demo polish, seed realistic data, fix critical bugs, prepare pitch | All |

---

## 11. Demo Script (for judges)

1. Open mobile app as **worker "Marco"** on Site "Zürich HB Tower"
2. Tap **Camera** → photograph a hard hat → AI classifies as "PPE" → shows PPE products
3. Select "Hard Hat EN397" → set quantity 3 → tap Order
4. Marco's budget limit is CHF 50, order is CHF 75 → **approval request sent**
5. Switch to mobile app as **approver "Sara"** → sees request with context → taps Approve
6. Marco receives "✅ Order confirmed" notification
7. Open web dashboard → Site "Zürich HB Tower" shows updated spend
8. Click into site → PPE category spending increased → order visible in history
9. Show PO PDF that was auto-generated and "sent to supplier"
10. Trigger supplier confirmation → Marco gets final confirmation in app

---

## 12. Out of Scope (for this hackathon)

- Real supplier email integration (simulate with a fixed test email)
- Native Swift app (use React Native for speed)
- Real document signing (placeholder signature is fine)
- Multi-language support
- Offline mode
- Real push notifications (use Supabase Realtime polling instead)
- Full authentication flow (use hardcoded seed users or magic link)

---

## 13. Environment Variables Needed

```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=           # for Whisper voice transcription
RESEND_API_KEY=           # for sending PO emails
```

---

*This outline is the single source of truth for the AI Construction Companion hackathon build. All AI tools, code generation, and decisions should align with this document.*
