/* global process, console */
import {createClient} from '@sanity/client'

const sanity = createClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset: 'production',
  token: process.env.SANITY_WRITE_TOKEN,
  useCdn: false,
  apiVersion: '2024-03-19',
})

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.headers['user-agent'] !== 'vercel-cron/1.0') {
    return res.status(405).json({error: 'Method not allowed'})
  }

  try {
    console.log('🏁 Starting F1 moment scraper...')

    const drivers = await sanity.fetch(`*[_type == "driver"] { _id, name }`)
    const today = new Date()
    const raceDate = today.toISOString().split('T')[0]

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
  "type": "string (one of: image, video, radio)"
}]`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages: [{role: 'user', content: prompt}],
      }),
    })

    if (!response.ok) {
      const err = await response.json()
      throw new Error(`Claude API error: ${err.error?.message ?? response.statusText}`)
    }

    const data = await response.json()
    const rawText = data.content[0].text.trim()

    // Strip markdown fences if Claude adds them despite instructions
    const cleaned = rawText
      .replace(/^```json\n?/, '')
      .replace(/\n?```$/, '')
      .trim()
    const moments = JSON.parse(cleaned)

    console.log(`✨ Claude returned ${moments.length} moments`)

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
