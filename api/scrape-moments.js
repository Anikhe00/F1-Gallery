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

export default async function handler(req, res) {
  // Allow POST and Vercel Cron
  if (req.method !== 'POST' && req.headers['user-agent'] !== 'vercel-cron/1.0') {
    return res.status(405).json({error: 'Method not allowed'})
  }

  try {
    console.log('🏁 Starting F1 moment scraper...')

    // 1. Get drivers
    const drivers = await sanity.fetch(`*[_type == "driver"] { _id, name }`)

    const today = new Date()
    const raceDate = today.toISOString().split('T')[0]

    // 2. Initialize Model with JSON Mode
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
      },
    })

    // 3. Optimized Prompt (Notice we don't strictly need Search Tool if we use a smart prompt,
    // but I'll keep the logic if you really want to search.
    // WARNING: Removing the tool will make it more stable on the free tier)
    const prompt = `Return a JSON array of 8-10 F1 moments for these drivers: ${drivers.map((d) => d.name).join(', ')}.
    Context: Race weekend around ${raceDate}.
    Format: [{"driverName": "string", "title": "string", "description": "string", "radio": "string", "type": "string"}]`

    // Note: If you keep hitting 429, comment out the "tools" section below
    const result = await model.generateContent({
      contents: [{role: 'user', parts: [{text: prompt}]}],
      tools: [{googleSearch: {}}],
    })

    const response = await result.response
    const moments = JSON.parse(response.text())

    console.log(`✨ Gemini found ${moments.length} moments`)

    const createdMoments = []

    // 4. Process Moments
    for (const moment of moments) {
      // Find driver (Case-insensitive)
      const driver = drivers.find(
        (d) =>
          d.name.toLowerCase().includes(moment.driverName.toLowerCase()) ||
          moment.driverName.toLowerCase().includes(d.name.toLowerCase()),
      )

      if (!driver) continue

      // Check if title exists already
      const existing = await sanity.fetch(`*[_type == "moment" && title == $title][0]`, {
        title: moment.title,
      })
      if (existing) continue

      // 5. Use a transaction for Sanity (Faster/more reliable)
      const newMoment = await sanity.create({
        _type: 'moment',
        title: moment.title,
        date: raceDate,
        description: moment.description,
        type: 'image',
        radio: moment.radio || null,
      })

      // Link to driver
      await sanity
        .patch(driver._id)
        .setIfMissing({moments: []})
        .append('moments', [{_type: 'reference', _ref: newMoment._id}])
        .commit()

      createdMoments.push(moment.title)
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
