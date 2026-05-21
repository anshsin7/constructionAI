import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json({ limit: '10mb' })) // large enough for base64 images

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const CATEGORIES = [
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

// ── POST /api/classify ──────────────────────────────────────────
app.post('/api/classify', async (req, res) => {
  const { type, data } = req.body
  // type: 'image' | 'text'
  // data: base64 string (image) or plain string (text/voice transcript)

  try {
    let messages

    if (type === 'image') {
      messages = [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${data}` }
            },
            {
              type: 'text',
              text: `You are a construction site procurement assistant.
Analyze this image and identify what construction product or material is shown or needed.
Return ONLY valid JSON, no markdown, no explanation:
{
  "category": "<one of: ${CATEGORIES.join(' | ')}>",
  "matched_product_name": "<best guess at specific product name, or null>",
  "confidence": "<high | medium | low>",
  "reasoning": "<one sentence>"
}`
            }
          ]
        }
      ]
    } else {
      messages = [
        {
          role: 'user',
          content: `You are a construction site procurement assistant.
A worker needs a product. Classify their request into the correct category.
Worker said: "${data}"

Return ONLY valid JSON, no markdown, no explanation:
{
  "category": "<one of: ${CATEGORIES.join(' | ')}>",
  "matched_product_name": "<best guess at specific product name, or null>",
  "confidence": "<high | medium | low>",
  "reasoning": "<one sentence>"
}`
        }
      ]
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      max_tokens: 200
    })

    const raw = completion.choices[0].message.content
    const classification = JSON.parse(raw)

    // Fetch matching products from Supabase
    const { data: products, error } = await supabase
      .from('products')
      .select('*, suppliers(name)')
      .eq('category', classification.category)
      .order('popularity_score', { ascending: false })

    if (error) throw error

    res.json({
      classification,
      products
    })

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

// ── Health check ────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.listen(process.env.PORT, () => {
  console.log(`Backend running on port ${process.env.PORT}`)
})
