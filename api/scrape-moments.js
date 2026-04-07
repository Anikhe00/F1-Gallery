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

// Convert a full name to Ergast driverId candidates
// Ergast uses slugs like "max_verstappen", "hamilton", "leclerc"
function nameToDriverIdCandidates(fullName) {
  const parts = fullName.toLowerCase().trim().split(/\s+/)
  const last = parts[parts.length - 1]
  const first = parts[0]
  return [
    `${first}_${last}`, // e.g. max_verstappen
    last, // e.g. hamilton
    `${first}${last}`, // e.g. carlossainz (rare)
  ]
}

// Fetch driver stats from Ergast F1 API, trying multiple driverId candidates
async function fetchDriverStats(fullName) {
  const candidates = nameToDriverIdCandidates(fullName)

  for (const driverId of candidates) {
    try {
      const driverRes = await fetch(`https://ergast.com/api/f1/drivers/${driverId}.json`)
      if (!driverRes.ok) continue

      const driverData = await driverRes.json()
      const driver = driverData.MRData?.DriverTable?.Drivers?.[0]
      if (!driver) continue

      // Fetch all race results for this driver
      const resultsRes = await fetch(
        `https://ergast.com/api/f1/drivers/${driverId}/results.json?limit=1000`,
      )
      if (!resultsRes.ok) continue

      const resultsData = await resultsRes.json()
      const races = resultsData.MRData?.RaceTable?.Races || []

      const wins = races.filter((r) => r.Results?.[0]?.position === '1').length

      const podiums = races.filter((r) => {
        const pos = parseInt(r.Results?.[0]?.position, 10)
        return !isNaN(pos) && pos >= 1 && pos <= 3
      }).length

      console.log(
        `✅ Matched "${fullName}" → Ergast driverId: "${driverId}" (${races.length} races, ${wins} wins, ${podiums} podiums)`,
      )

      return {
        driverId, // store so we can match season stats
        nationality: driver.nationality,
        dateOfBirth: driver.dateOfBirth,
        grandPrixEntered: races.length,
        careerWins: wins, // renamed to avoid confusion with season wins
        podiums,
      }
    } catch (error) {
      console.error(`Error trying driverId "${driverId}":`, error)
    }
  }

  console.warn(`⚠️ Could not find Ergast entry for "${fullName}"`)
  return null
}

// Fetch current season standings
async function fetchCurrentSeasonStats() {
  try {
    const response = await fetch('https://ergast.com/api/f1/current/driverStandings.json')
    const data = await response.json()
    const standings = data.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings || []

    return standings.map((s) => ({
      driverId: s.Driver.driverId, // e.g. "max_verstappen"
      position: parseInt(s.position, 10),
      points: parseFloat(s.points),
      seasonWins: parseInt(s.wins, 10), // renamed: these are season wins only
    }))
  } catch (error) {
    console.error('Error fetching season standings:', error)
    return []
  }
}

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
    if (!contentType.startsWith('image/')) return null

    const arrayBuffer = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const asset = await sanity.assets.upload('image', buffer, {filename, contentType})
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
    console.log('🏁 Starting F1 automation...')

    // PART 1: UPDATE DRIVER STATS
    console.log('\n📊 Updating driver stats from Ergast API...')

    const drivers = await sanity.fetch(`*[_type == "driver"] { _id, name, number, team }`)
    const currentSeasonStats = await fetchCurrentSeasonStats()
    const updatedDrivers = []

    for (const driver of drivers) {
      try {
        const stats = await fetchDriverStats(driver.name)

        if (!stats) {
          console.log(`⚠️ Skipping ${driver.name} — no Ergast data found`)
          continue
        }

        // Match season stats using the driverId we resolved above
        const seasonStats = currentSeasonStats.find((s) => s.driverId === stats.driverId)

        if (seasonStats) {
          console.log(
            `📈 Season stats for ${driver.name}: ${seasonStats.seasonWins} wins, ${seasonStats.points} pts`,
          )
        } else {
          console.warn(`⚠️ No current season entry for driverId "${stats.driverId}"`)
        }

        await sanity
          .patch(driver._id)
          .set({
            nationality: stats.nationality,
            dateOfBirth: stats.dateOfBirth,
            grandPrixEntered: stats.grandPrixEntered,
            wins: stats.careerWins, // career wins from full results
            podiums: stats.podiums,
            // Season-specific fields (only set if we have season data)
            ...(seasonStats && {
              currentSeasonPoints: seasonStats.points,
              currentSeasonWins: seasonStats.seasonWins,
              currentSeasonPosition: seasonStats.position,
            }),
          })
          .commit()

        console.log(`✅ Updated ${driver.name}`)
        updatedDrivers.push(driver.name)

        // Rate limit
        await new Promise((resolve) => setTimeout(resolve, 600))
      } catch (error) {
        console.error(`❌ Error updating ${driver.name}:`, error)
      }
    }

    // PART 2: CREATE RACE MOMENTS
    console.log('\n🏎️ Creating race moments...')

    const today = new Date()
    const lastSunday = new Date(today)
    lastSunday.setDate(today.getDate() - ((today.getDay() + 7) % 7))
    const raceDate = lastSunday.toISOString().split('T')[0]

    console.log(`Looking for moments from: ${raceDate}`)

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      generationConfig: {responseMimeType: 'application/json'},
    })

    const prompt = `You are an F1 expert. Generate a JSON array of 8-10 notable or iconic F1 moments
for these drivers: ${drivers.map((d) => d.name).join(', ')}.
Focus on memorable race wins and podium finishes, dramatic overtakes, race incidents, pole positions, radio messages that went viral, post-race celebrations, controversies or penalties, driver reactions and emotions, social media moments, and paddock drama.
Context: approximate date ${raceDate}.

For each moment, identify:
1. Which driver (from: ${drivers.map((d) => d.name).join(', ')})
2. A catchy title (max 50 chars)
3. Brief description (2-3 sentences, exciting tone!)
4. Team radio quote if available
5. Type of moment (image, video)

IMPORTANT: Every object MUST include the imageQuery field. Do not omit it.

Return ONLY a valid JSON array, no markdown, no backticks, no explanation. Schema:
[{
  "driverName": "string (must match one of the drivers listed above)",
  "title": "string (short, descriptive)",
  "description": "string (2-3 sentences about the moment)",
  "radio": "string or null (famous radio quote if applicable)",
  "type": "string (one of: image, video)",
  "imageQuery": "string (REQUIRED - specific Google image search query, e.g. 'Max Verstappen Abu Dhabi 2021 celebration podium')"
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
    console.log(`🔎 Sample imageQuery: ${moments[0]?.imageQuery}`)

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

      const momentDoc = {
        _type: 'moment',
        title: moment.title,
        date: raceDate,
        description: moment.description,
        type: ['image', 'video'].includes(moment.type) ? moment.type : 'image',
        radio: moment.radio || null,
        ...(imageAssetId && {
          image: {
            _type: 'image',
            asset: {_type: 'reference', _ref: imageAssetId},
          },
        }),
      }

      const newMoment = await sanity.create(momentDoc)

      await sanity
        .patch(driver._id)
        .setIfMissing({moments: []})
        .append('moments', [{_key: crypto.randomUUID(), _type: 'reference', _ref: newMoment._id}])
        .commit()

      createdMoments.push(moment.title)
      console.log(`✅ Created: ${moment.title} ${imageAssetId ? 'with image' : 'without image'}`)
    }

    return res.status(200).json({
      success: true,
      updatedDrivers,
      momentCount: createdMoments.length,
      moments: createdMoments,
    })
  } catch (error) {
    console.error('❌ Error:', error)
    return res.status(500).json({error: error.message})
  }
}
