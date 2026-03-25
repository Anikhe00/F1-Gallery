/* global process, console */
import {GoogleGenerativeAI} from '@google/generative-ai'
import {createClient} from '@sanity/client'

const sanity = createClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset: 'production',
  token: process.env.SANITY_WRITE_TOKEN,
  useCdn: false,
  apiVersion: '2024-03-19',
})

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

// Fetch image URL from Google Custom Search
async function findImageUrl(query) {
  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_SEARCH_API_KEY}&cx=${process.env.GOOGLE_SEARCH_CX}&q=${encodeURIComponent(query)}&searchType=image&num=1&imgType=photo&safe=active`
    const res = await fetch(url)
    const data = await res.json()
    return data.items?.[0]?.link ?? null
  } catch {
    return null
  }
}

// Download image and upload to Sanity
async function uploadImageToSanity(imageUrl, filename) {
  try {
    const res = await fetch(imageUrl)
    if (!res.ok) return null

    const contentType = res.headers.get('content-type') || 'image/jpeg'
    // Only accept actual images
    if (!contentType.startsWith('image/')) return null

    const arrayBuffer = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const asset = await sanity.assets.upload('image', buffer, {
      filename,
      contentType,
    })

    return asset._id
  } catch {
    return null
  }
}

export default async function handler(req, res) {
  const isVercelCron = req.headers['user-agent'] === 'vercel-cron/1.0'
  const isGithubCron = req.headers['authorization'] === `Bearer ${process.env.CRON_SECRET}`

  if (req.method !== 'POST' || (!isVercelCron && !isGithubCron)) {
    return res.status(405).json({error: 'Method not allowed'})
  }

  try {
    console.log('🏁 Starting F1 moment scraper...')

    const drivers = await sanity.fetch(`*[_type == "driver"] { _id, name }`)
    const today = new Date()
    const raceDate = today.toISOString().split('T')[0]

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      generationConfig: {
        responseMimeType: 'application/json',
      },
    })

    const prompt = `You are an F1 expert. Generate a JSON array of 8-10 notable or iconic F1 moments
for these drivers: ${drivers.map((d) => d.name).join(', ')}.
Focus on memorable race incidents, radio moments, celebrations, or controversies.
Context: approximate date ${raceDate}.
Return ONLY a valid JSON array, no markdown, no backticks, no explanation. Schema:
[{
  "driverName": "string (must match one of the drivers listed above)",
  "title": "string (short, descriptive)",
  "description": "string (2-3 sentences about the moment)",
  "radio": "string or null (famous radio quote if applicable)",
  "type": "string (one of: image, video)",
    "imageQuery": "string (specific Google image search query to find a photo of this moment, e.g. 'Max Verstappen Abu Dhabi 2021 celebration podium')"

}]`

    const result = await model.generateContent({
      contents: [{role: 'user', parts: [{text: prompt}]}],
    })

    const parts = result.response.candidates?.[0]?.content?.parts ?? []
    const rawText = parts
      .filter((p) => p.text)
      .map((p) => p.text)
      .join('')

    if (!rawText) throw new Error('Empty response from Gemini')

    const moments = JSON.parse(rawText)
    console.log(`✨ Gemini returned ${moments.length} moments`)

    const createdMoments = []

    for (const moment of moments) {
      const driver = drivers.find(
        (d) =>
          d.name.toLowerCase().includes(moment.driverName.toLowerCase()) ||
          moment.driverName.toLowerCase().includes(d.name.toLowerCase()),
      )

      if (!driver) {
        console.warn(`⚠️ No driver match for: ${moment.driverName}`)
        continue
      }

      const existing = await sanity.fetch(`*[_type == "moment" && title == $title][0]`, {
        title: moment.title,
      })
      if (existing) continue

      // Find and upload image
      let imageAssetId = null
      if (moment.imageQuery) {
        console.log(`🔍 Searching image for: ${moment.imageQuery}`)
        const imageUrl = await findImageUrl(moment.imageQuery)

        if (imageUrl) {
          console.log(`📸 Uploading image: ${imageUrl}`)
          const slug = moment.title.toLowerCase().replace(/\s+/g, '-').slice(0, 40)
          imageAssetId = await uploadImageToSanity(imageUrl, `${slug}.jpg`)
        }
      }

      // Build the document
      const momentDoc = {
        _type: 'moment',
        title: moment.title,
        date: raceDate,
        description: moment.description,
        type: ['image', 'video'].includes(moment.type) ? moment.type : 'image',
        radio: moment.radio || null,
      }

      // Attach image if we got one
      if (imageAssetId) {
        momentDoc.image = {
          _type: 'image',
          asset: {
            _type: 'reference',
            _ref: imageAssetId,
          },
        }
      }

      const newMoment = await sanity.create(momentDoc)

      await sanity
        .patch(driver._id)
        .setIfMissing({moments: []})
        .append('moments', [
          {
            _key: crypto.randomUUID(),
            _type: 'reference',
            _ref: newMoment._id,
          },
        ])
        .commit()

      createdMoments.push(moment.title)
      console.log(`✅ Created: ${moment.title} ${imageAssetId ? 'with image' : 'without image'}`)
    }

    return res.status(200).json({
      success: true,
      count: createdMoments.length,
      moments: createdMoments,
    })
  } catch (error) {
    console.error('❌ Error:', error)
    return res.status(500).json({error: error.message})
  }
}
