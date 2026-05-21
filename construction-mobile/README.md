# Construction Mobile (Expo)

Worker app for the AI construction companion — camera, voice, and text procurement.

## Prerequisites

1. Backend running: `cd ../construction-backend && npm start`
2. Supabase seed loaded: run `../supabase/seed.sql` in SQL Editor

## Run

```bash
cp .env.example .env
# Edit EXPO_PUBLIC_API_URL if not using iOS Simulator
npm start
```

Press `i` for iOS simulator or scan QR with Expo Go on your phone.

## Demo flow

1. **Marco** (worker) — Text → "I need screws for concrete" → order 3× Concrete Screw → awaits approval
2. Switch to **Sara** (approver) → Pending Approvals → Approve
3. Marco → My Orders → see status

## API URL by device

| Device | URL |
|--------|-----|
| iOS Simulator | `http://localhost:3001` |
| Android emulator | `http://10.0.2.2:3001` |
| Physical phone | `http://<your-mac-ip>:3001` |
