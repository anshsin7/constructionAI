# Temporary Gameplan

Great question. With AI doing the coding, **order of work matters more than usual** — because each AI session needs context from what was built before. Here's exactly how I'd attack it:

---

## The Golden Rule
**Always build bottom-up. Data layer first, UI last.**

If you start with the mobile app, the AI will invent fake data structures that clash with your real database later. That costs hours of fixing.

---

## The Order I'd Follow

### 🥇 Step 1 — Supabase Setup (1-2h)
**Do this first, everything else depends on it.**

Go to supabase.com, create a project, then open the SQL editor and paste the schema from `outline.md`. Also create seed data — fake workers, a site, fake products across categories.

- At the end of this step you should be able to open the Supabase table editor and see real rows
- This is your single source of truth for the entire project
- **Don't write any app code until this is done**

---

### 🥈 Step 2 — AI Classification Endpoint (1-2h)
**The riskiest technical piece — validate it early.**

Build one single backend route: `POST /api/classify`. It accepts an image (base64) or text string, calls GPT-4o, and returns a category + matched product name as JSON.

Test it with Postman or even just a curl command. Try a photo of a hard hat, try typing "I need screws", try a blurry image. Make sure it works reliably before any UI depends on it.

- If this works → you're confident the whole product works
- If this is flaky → you find out early, not at 3am

---

### 🥉 Step 3 — Backend API Routes (2-3h)
Build the core order flow routes in sequence:
1. `GET /api/products` — fetch products by category
2. `POST /api/orders` — create an order
3. `PATCH /api/orders/:id/approve` — approve it
4. `PATCH /api/orders/:id/reject` — reject it

No PDF, no emails yet. Just the database logic. Test each one in Postman before moving on.

---

### 🏅 Step 4 — Mobile App (3-4h)
Now the fun part — and it's fast because the backend is solid.

Build it screen by screen in this order:
1. Entry screen (3 big buttons)
2. Results screen (product list cards)
3. Order confirmation screen
4. "My Orders" status screen
5. Approver screen

For voice: wire up the microphone → Whisper → text → reuse the classify endpoint. It's literally two extra lines.

---

### Step 5 — PO Generation + Email (1-2h)
Once orders flow correctly, add the automation:
1. pdf-lib generates the PO PDF on order approval
2. Upload PDF to Supabase Storage
3. Send email with PDF attached via a simple nodemailer or Resend call
4. Add a `/confirm?po=id` link in the email for supplier confirmation

---

### Step 6 — Web Dashboard (2-3h)
Last, because it's the least risky and purely visual:
1. Site overview cards with budget bars
2. Site detail with spending by category (use Recharts)
3. Order history table
4. Employee budget editor
5. File upload page (bonus — do this only if time permits)

---

## Visualised

```
Supabase Schema + Seed Data
        ↓
  AI Classify Endpoint  ← validate this early!
        ↓
   Backend API Routes
        ↓
    Mobile App UI
        ↓
  PO + Email Automation
        ↓
   Web Dashboard
```

---

## How to Use AI Effectively Per Step

- **Start every Lovable/Cursor session** by pasting the relevant section of `outline.md` + saying "we have already built X, now build Y"
- **One feature per session** — don't ask the AI to build the whole app at once
- **Always paste your Supabase schema** when asking for any backend or data code — otherwise it invents its own table names
- **For the mobile app**, describe one screen at a time, not the whole flow

---

## If You Run Out of Time

Cut in this order — the demo still works:
1. ❌ File upload / document parsing (skip entirely)
2. ❌ Real supplier email (hardcode a confirmation after 10 seconds instead)
3. ❌ Web dashboard file upload page
4. ✅ Keep: classify → order → approve → PO → confirm — this is the core demo loop

The judges need to see that one loop work end-to-end. Everything else is bonus.
