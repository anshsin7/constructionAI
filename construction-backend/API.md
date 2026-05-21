# Construction Backend API

Base URL: `http://localhost:3001`

## Setup

1. Copy `.env.example` → `.env` and fill in keys
2. Run `supabase/schema.sql` then `supabase/seed.sql` in the Supabase SQL Editor
3. `npm start`

## Endpoints

### `GET /api/health`
Health check.

### `POST /api/classify`
Body: `{ "type": "text"|"image", "data": "..." }`

### `GET /api/products?category=Fasteners&search=screw`
List products (optional filters).

### `POST /api/orders`
Creates an order. Auto-approves if `total_price <= requestor.budget_limit`.

```json
{
  "requestor_id": "22222222-2222-2222-2222-222222222201",
  "product_id": "44444444-4444-4444-4444-444444444403",
  "quantity": 3,
  "input_method": "text",
  "ai_classification": { "category": "Fasteners", "confidence": "high" }
}
```

Marco (budget CHF 50) × 3 concrete screws (CHF 24) = CHF 72 → `pending_approval`.

### `GET /api/orders?requestor_id=&approver_id=&status=`
List orders (filter by requestor, approver, or status).

### `POST /api/transcribe`
Body: `{ "audio": "<base64 m4a>" }` → Whisper transcript for voice input.

### `GET /api/orders/:id`
Order detail.

### `PATCH /api/orders/:id/approve`
```json
{ "approver_id": "22222222-2222-2222-2222-222222222202", "approval_note": "OK for site" }
```

### `PATCH /api/orders/:id/reject`
Same body shape as approve.

### `POST /api/orders/:id/po`
Generate PO PDF, upload to Supabase Storage, email `PO_TEST_EMAIL` from `.env` (never supplier DB email), set status `po_sent`.  
(Also runs automatically after approve / auto-approve.)

### `GET /confirm?po=<orderId>`
Supplier confirmation page — sets order to `confirmed` and updates site spend.

### `POST /api/supplier/confirm`
Body: `{ "po": "<orderId>" }` — same as GET confirm, returns JSON.

### `GET /api/sites`
List sites with `active_orders` count.

### `GET /api/sites/:id`
Site detail: `orders`, `employees`, `category_breakdown`.

### `PATCH /api/users/:id/budget`
Body: `{ "budget_limit": 50 }`

## Quick test (after seed)

```bash
curl -s "http://localhost:3001/api/products?category=Fasteners"
curl -s -X POST http://localhost:3001/api/orders \
  -H "Content-Type: application/json" \
  -d '{"requestor_id":"22222222-2222-2222-2222-222222222201","product_id":"44444444-4444-4444-4444-444444444403","quantity":3,"input_method":"text"}'
```
