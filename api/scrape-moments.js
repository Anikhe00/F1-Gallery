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

// Jolpica is the maintained replacement for the defunct Ergast API (same URL shape)
const JOLPICA = 'https://api.jolpi.ca/ergast/f1'

function nameToDriverIdCandidates(fullName) {
  const parts = fullName.toLowerCase().trim().split(/\s+/)
  const first = parts[0]
  const last = parts[parts.length - 1]
  return [
    `${first}_${last}`, // max_verstappen, lando_norris
    last, // hamilton, alonso
    `${first}${last}`, // carlossainz (rare)
  ]
}

async function fetchDriverStats(fullName) {
  const candidates = nameToDriverIdCandidates(fullName)

  for (const driverId of candidates) {
    try {
      const driverRes = await fetch(`${JOLPICA}/drivers/${driverId}.json`)
      if (!driverRes.ok) continue

      const driverData = await driverRes.json()
      const driver = driverData.MRData?.DriverTable?.Drivers?.[0]
      if (!driver) continue

      const resultsRes = await fetch(`${JOLPICA}/drivers/${driverId}/results.json?limit=1000`)
      if (!resultsRes.ok) continue

      const resultsData = await resultsRes.json()
      const races = resultsData.MRData?.RaceTable?.Races || []

      const wins = races.filter((r) => r.Results?.[0]?.position === '1').length
      const podiums = races.filter((r) => {
        const pos = parseInt(r.Results?.[0]?.position, 10)
        return !isNaN(pos) && pos >= 1 && pos <= 3
      }).length

      console.log(
        `✅ "${fullName}" → driverId: "${driverId}" | ` +
          `${races.length} races, ${wins} wins, ${podiums} podiums`,
      )

      return {
        driverId,
        nationality: driver.nationality,
        dateOfBirth: driver.dateOfBirth,
        grandPrixEntered: races.length,
        careerWins: wins,
        podiums,
      }
    } catch (error) {
      console.error(`Error trying driverId "${driverId}":`, error)
    }
  }

  console.warn(`⚠️ No Jolpica entry found for "${fullName}"`)
  return null
}

async function fetchCurrentSeasonStats() {
  try {
    const response = await fetch(`${JOLPICA}/current/driverStandings.json`)
    const data = await response.json()
    const standings = data.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings || []

    return standings.map((s) => ({
      driverId: s.Driver.driverId,
      position: parseInt(s.position, 10),
      points: parseFloat(s.points),
      seasonWins: parseInt(s.wins, 10),
    }))
  } catch (error) {
    console.error('Error fetching season standings:', error)
    return []
  }
}

async function findImageUrl(query) {
  try {
    const url =
      `https://www.googleapis.com/customsearch/v1` +
      `?key=${process.env.GOOGLE_SEARCH_API_KEY}` +
      `&cx=${process.env.GOOGLE_SEARCH_CX}` +
      `&q=${encodeURIComponent(query)}` +
      `&searchType=image&num=1&imgType=photo&safe=active`
    const res = await fetch(url)
    const data = await res.json()
    return data.items?.[0]?.link ?? null
  } catch {
    return null
  }
}

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
    console.log('\n📊 Updating driver stats from Jolpica API...')

    const drivers = await sanity.fetch(`*[_type == "driver"] { _id, name, number, team }`)

    console.log(`Found ${drivers.length} driver(s) in Sanity`)

    const currentSeasonStats = await fetchCurrentSeasonStats()
    console.log(`Fetched ${currentSeasonStats.length} entries from current season standings`)

    const updatedDrivers = []

    for (const driver of drivers) {
      try {
        console.log(`\nProcessing: ${driver.name}`)
        const stats = await fetchDriverStats(driver.name)

        if (!stats) {
          console.log(`⚠️ Skipping ${driver.name} — no data found`)
          continue
        }

        const seasonStats = currentSeasonStats.find((s) => s.driverId === stats.driverId)

        if (seasonStats) {
          console.log(
            `📈 Season: P${seasonStats.position}, ` +
              `${seasonStats.points} pts, ${seasonStats.seasonWins} wins`,
          )
        } else {
          console.warn(`⚠️ No current season entry for "${stats.driverId}"`)
        }

        const patch = {
          nationality: stats.nationality,
          dateOfBirth: stats.dateOfBirth,
          grandPrixEntered: stats.grandPrixEntered,
          wins: stats.careerWins,
          podiums: stats.podiums,
          ...(seasonStats && {
            currentSeasonPoints: seasonStats.points,
            currentSeasonWins: seasonStats.seasonWins,
            currentSeasonPosition: seasonStats.position,
          }),
        }

        console.log(`Patching with:`, JSON.stringify(patch))

        const result = await sanity.patch(driver._id).set(patch).commit()
        console.log(`✅ Committed — rev: ${result._rev}`)
        updatedDrivers.push(driver.name)

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
Focus on memorable race wins and podium finishes, dramatic overtakes, race incidents, pole positions,
radio messages that went viral, post-race celebrations, controversies or penalties,
driver reactions and emotions, social media moments, and paddock drama.
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
  "title": "string",
  "description": "string",
  "radio": "string or null",
  "type": "string (image or video)",
  "imageQuery": "string (e.g. 'Lando Norris Monaco 2024 win celebration')"
}]`

    const geminiResult = await model.generateContent({
      contents: [{role: 'user', parts: [{text: prompt}]}],
    })

    const parts = geminiResult.response.candidates?.[0]?.content?.parts ?? []
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
      if (existing) {
        console.log(`⏭️ Already exists: ${moment.title}`)
        continue
      }

      let imageAssetId = null
      if (moment.imageQuery) {
        const imageUrl = await findImageUrl(moment.imageQuery)
        if (imageUrl) {
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
    console.error('❌ Fatal error:', error)
    return res.status(500).json({error: error.message})
  }
}
