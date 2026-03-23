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

// Initialize Gemini (FREE!)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

export default async function handler(req, res) {
  // Security check
  if (req.method !== 'POST' && req.headers['user-agent'] !== 'vercel-cron/1.0') {
    return res.status(405).json({error: 'Method not allowed'})
  }

  try {
    console.log('🏁 Starting F1 moment scraper with Gemini...')

    // Step 1: Get all drivers from Sanity
    const drivers = await sanity.fetch(`*[_type == "driver"] {
      _id,
      name,
      number,
      team
    }`)
    console.log(`📋 Found ${drivers.length} drivers in Sanity`)

    // Step 2: Determine last race weekend
    const today = new Date()
    const lastSunday = new Date(today)
    lastSunday.setDate(today.getDate() - ((today.getDay() + 7) % 7))
    const raceDate = lastSunday.toISOString().split('T')[0]
    console.log(`🏎️ Looking for moments from: ${raceDate}`)

    // Step 3: Use Gemini with Google Search to find F1 moments
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp', // Free tier model
      tools: [
        {
          googleSearch: {}, // Enable Google Search grounding (FREE!)
        },
      ],
    })

    const prompt = `Search the web for Formula 1 race highlights and memorable moments from the most recent F1 race weekend (around ${raceDate}). 

Find 8-10 exciting moments that F1 fans would love to remember. Look for:
- Race wins and podium finishes
- Dramatic overtakes
- Crashes or incidents
- Pole positions
- Team radio messages that went viral
- Post-race celebrations
- Controversies or penalties
- Driver reactions and emotions
- Social media moments
- Paddock drama

For each moment, identify:
1. Which driver (from: ${drivers.map((d) => d.name).join(', ')})
2. A catchy title (max 50 chars)
3. Brief description (2-3 sentences, exciting tone!)
4. Team radio quote if available
5. Type of moment

Return ONLY a valid JSON array like this:
[
  {
    "driverName": "Lewis Hamilton",
    "title": "First Ferrari Podium!",
    "description": "The tifosi erupted as Hamilton brought Ferrari to the podium in his debut race. Emotional scenes in the pit lane as the dream began.",
    "radio": "Forza Ferrari! This is just the beginning!",
    "type": "podium"
  }
]

Be concise, exciting, and focus on moments that capture the emotion and drama of F1!`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()

    console.log('📝 Gemini response received')

    // Step 4: Parse the JSON response
    let moments = []
    try {
      // Extract JSON from response (might have markdown formatting)
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        moments = JSON.parse(jsonMatch[0])
        console.log(`✨ Found ${moments.length} moments`)
      } else {
        console.error('No JSON found in response:', text)
        return res.status(500).json({
          error: 'Failed to parse AI response',
          response: text,
        })
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError)
      return res.status(500).json({
        error: 'Failed to parse JSON',
        response: text,
      })
    }

    // Step 5: Create moments in Sanity
    const createdMoments = []

    for (const moment of moments) {
      try {
        // Find matching driver in Sanity
        const driver = drivers.find((d) => {
          const lastName = d.name.split(' ').pop().toLowerCase()
          const momentLastName = moment.driverName.split(' ').pop().toLowerCase()
          return lastName === momentLastName
        })

        if (!driver) {
          console.log(`⚠️ Driver not found: ${moment.driverName}`)
          continue
        }

        // Check for duplicates
        const existing = await sanity.fetch(`*[_type == "moment" && title == $title][0]`, {
          title: moment.title,
        })

        if (existing) {
          console.log(`⏭️ Already exists: ${moment.title}`)
          continue
        }

        // Create the moment
        const newMoment = await sanity.create({
          _type: 'moment',
          title: moment.title,
          date: raceDate,
          description: moment.description,
          type: 'image', // Default to image
          radio: moment.radio || null,
        })

        console.log(`✅ Created: ${moment.title}`)

        // Link to driver
        await sanity
          .patch(driver._id)
          .setIfMissing({moments: []})
          .append('moments', [{_type: 'reference', _ref: newMoment._id}])
          .commit()

        console.log(`🔗 Linked to: ${driver.name}`)

        createdMoments.push({
          moment: newMoment,
          driver: driver.name,
        })
      } catch (error) {
        console.error(`Error processing: ${moment.title}`, error)
      }
    }

    // Step 6: Return results
    return res.status(200).json({
      success: true,
      message: `Created ${createdMoments.length} new moments`,
      moments: createdMoments,
      raceDate,
      totalFound: moments.length,
    })
  } catch (error) {
    console.error('❌ Error:', error)
    return res.status(500).json({
      error: error.message,
      stack: error.stack,
    })
  }
}
