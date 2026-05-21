# How to run everything

Three parts: **Supabase** (database, once), **backend** (API), **mobile app** (Expo). Use separate terminal tabs for backend and mobile.

---

## One-time setup

### 1. Supabase (browser, not a terminal)

In [supabase.com/dashboard](https://supabase.com/dashboard) → your project → **SQL Editor**, run these **in order** (copy the full file contents each time, not the filename):

| Order | File |
|-------|------|
| 1 | `supabase/reset.sql` — only if you want a clean wipe |
| 2 | `supabase/schema.sql` |
| 3 | `supabase/seed.sql` |
| 4 | `supabase/fix-approvals.sql` — fixes Marco → Sara + disables RLS |

Check **Table Editor** → `products` should have 5 rows, `users` should have Marco & Sara.

### 2. Backend env

```bash
cd construction-backend
cp .env.example .env
```

Edit `.env` with your keys from Supabase **Settings → API**:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `OPENAI_API_KEY`
- `PORT=3001`

### 3. Mobile env

```bash
cd construction-mobile
cp .env.example .env
```

Default is fine for **iOS Simulator**:

```env
EXPO_PUBLIC_API_URL=http://localhost:3001
```

| Where you run the app | `EXPO_PUBLIC_API_URL` |
|----------------------|------------------------|
| iOS Simulator | `http://localhost:3001` |
| Android emulator | `http://10.0.2.2:3001` |
| Physical phone (Expo Go) | `http://YOUR_MAC_IP:3001` |

Find Mac IP: **System Settings → Network**, or terminal: `ipconfig getifaddr en0`

---

## Every time you develop

### Terminal 1 — Backend API

```bash
cd construction-backend
npm install          # first time only
npm start
```

You should see:

```text
Backend running on port 3001
```

If you previously started the backend before order-list code was added, **stop it fully** first:

```bash
lsof -ti:3001 | xargs kill -9
npm start
```

Confirm the new routes exist:

```bash
curl "http://localhost:3001/api/orders?requestor_id=22222222-2222-2222-2222-222222222201"
# → JSON like {"orders":[...]}  — NOT "Cannot GET /api/orders"
```

Quick check (optional, **Terminal 3** or same tab):

```bash
curl http://localhost:3001/api/health
# → {"status":"ok"}

curl "http://localhost:3001/api/products?category=Fasteners"
# → should list products if seed ran
```

---

### Terminal 2 — Mobile app

```bash
cd construction-mobile
npm install          # first time only
npm start
```

Then in the Expo terminal:

| Key | Action |
|-----|--------|
| `i` | Open **iOS Simulator** |
| `a` | Open Android emulator |
| Scan QR | **Expo Go** on your phone (set `.env` to Mac IP first) |

---

## Camera & microphone notes

| Feature | iOS Simulator | Real iPhone |
|---------|---------------|-------------|
| **Camera** | No camera — use **Photo library** when prompted | **Take photo** works |
| **Microphone** | Not supported — use **Text** instead | Tap record → stop → search |

After code changes, restart Expo: `Ctrl+C` in the mobile terminal, then `npm start` again.

---

## Demo flow in the app

1. **Marco** selected on home → **Text** → `I need screws for concrete` → pick product → **Order**
2. **My Orders (Marco)** → order appears (`pending_approval` if over CHF 50 budget)
3. Switch to **Sara** → **Pending Approvals** → Approve or Reject
4. Back to **Marco** → **My Orders** → status updated

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Empty products / orders | Re-run `supabase/seed.sql` and `fix-approvals.sql` in SQL Editor |
| `Network request failed` on phone | Use Mac LAN IP in `construction-mobile/.env`, not `localhost` |
| Port 3001 in use | `lsof -ti:3001 \| xargs kill -9` then `npm start` again in `construction-backend` |
| Backend still old code | Restart Terminal 1 (`Ctrl+C`, then `npm start`) |
| **`Cannot GET /api/orders`** in the app | Old backend still running — kill port 3001 and restart (see below) |
| Red error on My Orders | Read the message; it shows the API URL the app is calling |

---

## Optional: test API without the app

With backend running:

```bash
# Classify
curl -X POST http://localhost:3001/api/classify \
  -H "Content-Type: application/json" \
  -d '{"type":"text","data":"I need screws for concrete"}'

# Create order (Marco, concrete screws × 3)
curl -X POST http://localhost:3001/api/orders \
  -H "Content-Type: application/json" \
  -d '{"requestor_id":"22222222-2222-2222-2222-222222222201","product_id":"44444444-4444-4444-4444-444444444403","quantity":3,"input_method":"text"}'

# Marco's orders
curl "http://localhost:3001/api/orders?requestor_id=22222222-2222-2222-2222-222222222201"

# Sara's pending approvals
curl "http://localhost:3001/api/orders?approver_id=22222222-2222-2222-2222-222222222202&status=pending_approval"
```

More API detail: `construction-backend/API.md`
