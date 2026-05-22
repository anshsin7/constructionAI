# C-Flow — AI-Powered Construction Procurement

## Summary

C-Flow eliminates the chaos of construction site ordering. Workers snap a photo, speak, or type what they need — AI identifies the product instantly and triggers the entire procurement pipeline: approval routing, purchase order generation, supplier communication, and delivery confirmation. No paperwork, no phone calls, no delays.

## The Problem

Construction procurement is broken:

- **Workers lose hours** searching catalogs, calling suppliers, or waiting for office staff to place orders
- **Procurement teams drown** in manual PO creation, email chains, and spreadsheet tracking
- **Budget overruns go unnoticed** because there's no real-time visibility into site spending
- **Orders get duplicated or lost** when communicated verbally or via text messages
- **Approval bottlenecks** delay critical materials, stalling entire work crews

On a typical site, a single material order takes 20–45 minutes from request to PO — involving 3+ people and multiple systems.

## Our Solution

C-Flow compresses the entire procurement cycle into **under 60 seconds** with zero manual data entry.

### Key Highlights

**90% Time Reduction per Order**
What takes 30+ minutes manually happens in under a minute: worker identifies need → AI matches product → one-tap order → auto-approval routing → PO generated and sent to supplier. No one has to type product codes, look up prices, or draft emails.

**Intelligent Batch Ordering**
Non-urgent orders are automatically queued and batched per supplier per site — sent at a configurable daily window. This consolidates shipments, reduces delivery fees, and gives procurement leverage for volume pricing.

**Budget Control in Real-Time**
Every order is checked against per-worker budget limits. Over-budget requests route to approvers instantly. Procurement sees live spending by site and category — no end-of-month surprises.

**Works in Harsh Conditions**
The mobile app is purpose-built for construction sites: high-contrast UI readable in direct sunlight, massive touch targets usable with gloves, and three input methods (camera, voice, text) so workers can order regardless of conditions.

**Automated PO Pipeline**
Once approved, the system generates a professional PDF purchase order, emails it to the supplier, and tracks confirmation — closing the loop without human intervention.

## How It Works

```
┌─────────────────────────────────────────────────────────┐
│  WORKER (Mobile App)                                    │
│                                                         │
│  📷 Photo  /  🎤 Voice  /  ⌨️ Text                      │
│       ↓                                                 │
│  AI identifies product from catalog                     │
│       ↓                                                 │
│  Select item → Choose urgency → Submit                  │
└─────────────────────┬───────────────────────────────────┘
                      │
         ┌────────────┴────────────┐
         │                         │
    [Under budget]            [Over budget]
         │                         │
         ↓                         ↓
   Auto-approved            Routed to approver
         │                         │
         │                    ✅ / ❌
         │                         │
         └────────────┬────────────┘
                      │
                      ↓
        ┌─────────────────────────┐
        │  PO Auto-Generated      │
        │  PDF created & emailed  │
        │  to supplier            │
        └────────────┬────────────┘
                     │
                     ↓
        ┌─────────────────────────┐
        │  Supplier confirms      │
        │  Worker notified ✅     │
        │  Spending updated       │
        └─────────────────────────┘
```

**Procurement Dashboard** gives sourcing teams full visibility: spending by site and category, order history, approval queues, employee budget management, and catalog uploads (CSV/XLSX/PDF parsed by AI).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile App | React Native (Expo), TypeScript |
| Web Dashboard | Next.js, React, Tailwind CSS |
| Backend API | Node.js, Express |
| Database | Supabase (PostgreSQL) |
| AI | OpenAI GPT-4o (classification, product matching, document parsing) |
| Voice | OpenAI Whisper (speech-to-text) |
| PO Generation | pdf-lib (PDF creation) |
| Email | Resend (transactional email) |
| Hosting | Vercel (web), local/cloud (API) |
