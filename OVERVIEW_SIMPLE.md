# AI Construction Companion
## What We're Building — Plain Language Overview

---

## The Problem We're Solving

On a construction site, when a worker needs a tool or material, the current process is slow and manual:
- They have to call or message someone in procurement
- Procurement has to check what's available and from which supplier
- Someone has to create a purchase order manually
- Approvals happen over WhatsApp or email, with no clear trail
- Nobody has a live view of how much money is being spent where

This costs time, causes delays, and makes it nearly impossible to track spending across multiple sites.

---

## Our Solution — In One Sentence

A mobile app that lets any construction worker order materials in seconds using their camera, voice, or text — with automatic approvals, automatic purchase orders, and a live spending dashboard for management.

---

## How It Works — Step by Step

### 1. The Worker Opens the App
They see three big buttons. They pick whichever is easiest for them right now:

- 📷 **Camera** — they point their phone at the item they need (or something similar to it)
- 🎤 **Microphone** — they say out loud what they need, even with gloves on
- ⌨️ **Text** — they type what they need

### 2. The AI Understands the Request
The app uses artificial intelligence to figure out exactly what the worker needs, even from a photo or a rough description. It then shows a list of matching products that the company already has contracts for, sorted by what's most commonly ordered.

### 3. The Worker Places the Order
They tap the item, choose how many they need, and press **Order**. That's it from their side.

### 4. Approval (if needed)
- If the order is **below their personal spending limit** → it goes through automatically
- If the order is **above their limit** → their manager gets a notification on their phone instantly

The manager sees: who is requesting, what they need, how much it costs, and which site it's for. They tap **Approve** or **Reject** — done in seconds.

### 5. The Purchase Order is Created Automatically
Once approved, the system automatically:
- Creates a professional PDF purchase order
- Signs it digitally
- Emails it directly to the supplier

No human involvement needed.

### 6. Everyone Gets Notified
- The worker gets a confirmation that their order is on its way
- Once the supplier confirms, the worker gets a final "✅ Order confirmed" message
- The procurement team sees the new order appear in their dashboard automatically

---

## The Management Dashboard (Web App)

Procurement and management teams get a separate web application where they can see everything in one place:

### Spending Overview
A live view of every construction site, showing:
- How much budget has been used vs. what's available
- Which categories (tools, safety equipment, materials, etc.) are costing the most
- Trends over time

### Order History
A full log of every order ever placed, including:
- What was ordered
- Who ordered it
- Who approved it
- Which site it was for
- The purchase order document

### Employee Budget Control
Managers can set individual spending limits per employee. For example:
- A senior site manager might be allowed to order up to CHF 500 without approval
- A junior worker might need approval for anything over CHF 50

### Product Catalog Management
The procurement team can upload their existing supplier contracts, price lists, and product catalogs (as Excel or PDF files). The system reads these automatically and builds a searchable product database — so workers only ever order from pre-approved, contracted suppliers.

---

## What Makes This Different

| Old Way | Our Way |
|---|---|
| Phone calls and WhatsApp messages | One tap in an app |
| Manual purchase order creation | Fully automatic |
| Approvals lost in email threads | Instant mobile notifications with full context |
| No spending visibility | Live dashboard per site and category |
| Products ordered from random suppliers | Only contracted, pre-approved suppliers |
| Paper trail is incomplete | Every action logged automatically |

---

## What the App Does NOT Do (Scope Boundaries)

To be clear about what is included in this version:

- ✅ Mobile app for workers (iOS and Android)
- ✅ Approval flow via mobile notifications
- ✅ Automatic PO generation and email to supplier
- ✅ Web dashboard for procurement teams
- ✅ Budget limits per employee
- ✅ Product catalog from uploaded documents
- ❌ Direct integration with SAP or other ERP systems (future phase)
- ❌ Inventory tracking on-site (future phase)
- ❌ Supplier portal / supplier-side app (future phase)
- ❌ Multi-language support (future phase)
- ❌ Offline mode without internet connection (future phase)

---

## Who Uses What

| Person | Tool | What They Do |
|---|---|---|
| Site Worker | Mobile App | Requests materials via camera, voice, or text |
| Site Manager / Approver | Mobile App | Approves or rejects requests on the go |
| Procurement Team | Web Dashboard | Monitors spending, manages budgets, uploads contracts |
| Supplier | Email | Receives purchase orders, replies to confirm |

---

## The Flow, Visualised

```
Worker takes photo / speaks / types
          ↓
    AI identifies product
          ↓
    Worker confirms order
          ↓
   Needs approval?
   ↙            ↘
  No             Yes
  ↓               ↓
  ↓          Manager notified
  ↓          Manager approves
  ↓               ↓
  PO auto-generated & sent to supplier
          ↓
   Supplier confirms
          ↓
  Worker notified ✅
  Dashboard updated 📊
```

---

## Why AI? Why Now?

Construction is one of the last industries still running procurement on phone calls and spreadsheets. The technology to fix this has existed for years, but it was too complex and too expensive to build for individual companies.

Large language models (the same technology behind ChatGPT) now make it possible to understand a photo of a broken drill bit, match it to the right replacement in a catalog of thousands of products, and do it in under two seconds — without any manual configuration.

We're using this technology not to replace workers, but to remove the administrative friction that slows them down and wastes company money.

---

*Document prepared for stakeholder review · AI Construction Companion Hackathon Project*
