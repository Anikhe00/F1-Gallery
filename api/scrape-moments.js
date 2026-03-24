/* global process, console */
import {GoogleGenerativeAI} from '@google/generative-ai'
import {createClient} from '@sanity/client'
import {v4 as uuidv4} from 'uuid'

const sanity = createClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset: 'production',
  token: process.env.SANITY_WRITE_TOKEN,
  useCdn: false,
  apiVersion: '2024-03-19',
})

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.headers['user-agent'] !== 'vercel-cron/1.0') {
    return res.status(405).json({error: 'Method not allowed'})
  }

  try {
    console.log('🏁 Starting F1 moment scraper...')

    const drivers = await sanity.fetch(`*[_type == "driver"] { _id, name }`)
    const today = new Date()
    const raceDate = today.toISOString().split('T')[0]

    // ✅ No googleSearch tool — compatible with JSON mode
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
      },
    })

    const prompt = `You are an F1 expert. Generate a JSON array of 8-10 notable or iconic F1 moments 
for these drivers: ${drivers.map((d) => d.name).join(', ')}.
Focus on memorable race incidents, radio moments, celebrations, or controversies.
Context: approximate date ${raceDate}.
Return ONLY a valid JSON array, no markdown. Schema:
[{
  "driverName": "string (must match one of the drivers above)",
  "title": "string (short, descriptive)",
  "description": "string (2-3 sentences about the moment)",
  "radio": "string or null (famous radio quote if applicable)",
  "type": "string (one of: image, video, radio)"
}]`

    const result = await model.generateContent({
      contents: [{role: 'user', parts: [{text: prompt}]}],
    })

    // ✅ Safe text extraction
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

      const newMoment = await sanity.create({
        _type: 'moment',
        title: moment.title,
        date: raceDate,
        description: moment.description,
        type: moment.type || 'image',
        radio: moment.radio || null,
      })

      // ✅ _key is required for Sanity array references
      await sanity
        .patch(driver._id)
        .setIfMissing({moments: []})
        .append('moments', [
          {
            _key: uuidv4(),
            _type: 'reference',
            _ref: newMoment._id,
          },
        ])
        .commit()

      createdMoments.push(moment.title)
      console.log(`✅ Created: ${moment.title}`)
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
