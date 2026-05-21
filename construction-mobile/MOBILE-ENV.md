# Mobile app — what goes in `.env`

The phone app **never** uses Supabase secret keys. That is intentional and correct.

```
Phone (Expo)  →  your backend (port 3001)  →  Supabase + OpenAI + Resend
```

| Variable | Mobile? | Why |
|----------|---------|-----|
| `EXPO_PUBLIC_API_URL` | **Yes** | Address of `construction-backend` on your Mac |
| `SUPABASE_SERVICE_ROLE_KEY` | **No** | Server-only — would expose full DB access if baked into the app |
| `SUPABASE_ANON_KEY` | **No** | Not needed; backend already talks to Supabase |
| `OPENAI_API_KEY` | **No** | Backend only |
| `RESEND_API_KEY` | **No** | Backend only |

When Sara approves on the phone, the app calls `PATCH /api/orders/.../approve`. The **backend** uses `SUPABASE_SERVICE_ROLE_KEY` to upload the PDF and send email. Marco sees updated status via `GET /api/orders` — same API.

### `construction-mobile/.env` (only this)

```env
EXPO_PUBLIC_API_URL=http://192.168.x.x:3001
```

Expo Go often auto-fills your Mac IP — check **API:** on the home screen.
