import type { Goals, MealAnalysis, InBodyData, UserProfile } from './types'

const MOCK_COACHING = [
  'این وعده کربوهیدرات بالایی داره. سعی کن یه منبع پروتئین مثل تخم‌مرغ، مرغ یا حبوبات بهش اضافه کنی تا دیرتر گرسنه بشی.',
  'جانک فود پر از چربی ترانس و قند پنهانه که سریع گرسنه‌ات می‌کنه. یه لیوان آب بخور الان، و وعده بعدی رو با پروتئین شروع کن.',
  'غذای خوبی خوردی! برای اینکه پروتئین بیشتری داشته باشی، می‌تونی دفعه بعد یه کم ماست یا پنیر هم اضافه کنی.',
  'این وعده چربی اشباع داره. آب بیشتر بخور — خیلی‌وقت‌ها بدن تشنگی رو با گرسنگی اشتباه می‌گیره.',
  'میان‌وعده سبک بود. اگه زود گرسنه شدی، یه مشت آجیل یا یه تخم‌مرغ آب‌پز بخور — پروتئین سیری‌ات رو بالا می‌بره.',
]

const MOCK_FIT = [
  'این وعده با هدف کاهش وزنت خوب هماهنگه — ادامه بده! 🌿',
  'کالری خوبه ولی پروتئین کمه. سعی کن وعده بعدی پروتئین بیشتری داشته باشه.',
  'کمی سنگین بود — مشکلی نیست، بقیه‌ی روز رو سبک‌تر پیش برو.',
  'انتخاب متعادلی داشتی. همین روند رو حفظ کن.',
]

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function mockAnalysis(): MealAnalysis {
  const calories = 350 + Math.floor(Math.random() * 400)
  const protein = 12 + Math.floor(Math.random() * 25)
  const fits = ['good', 'okay', 'watch_out'] as const
  const fit_with_goal = fits[Math.floor(Math.random() * fits.length)]
  return {
    calories_estimate: calories,
    protein_estimate: protein,
    fit_with_goal,
    fit_sentence: pick(MOCK_FIT),
    suggestion: 'یه لیوان آب بخور بعد از هر وعده — هم هضم رو بهتر می‌کنه هم سیری رو.',
    coaching: pick(MOCK_COACHING),
    is_mock: true,
  }
}

export async function extractInBody(imageBase64: string, mimeType: string): Promise<InBodyData> {
  const useMock = import.meta.env.VITE_USE_MOCK === 'true'

  if (useMock) {
    await new Promise((r) => setTimeout(r, 1000))
    return {
      body_fat_percent: 24.5,
      muscle_mass_kg: 31.2,
      bmr: 1420,
      visceral_fat_level: 7,
    }
  }

  const prompt =
    'This is an InBody body composition test result. Extract these values as JSON: {body_fat_percent, muscle_mass_kg, bmr, visceral_fat_level}. If a value is not found, use 0.'

  const response = await fetch('/api/claude', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mimeType, data: imageBase64 },
            },
            { type: 'text', text: prompt },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error('API error ' + response.status)
  }

  const data = await response.json()
  try {
    const text: string = data.content[0].text
    // strip possible markdown code fences
    const clean = text.replace(/```[a-z]*\n?/g, '').trim()
    const parsed = JSON.parse(clean)
    return {
      body_fat_percent: parsed.body_fat_percent ?? 0,
      muscle_mass_kg: parsed.muscle_mass_kg ?? 0,
      bmr: parsed.bmr ?? 0,
      visceral_fat_level: parsed.visceral_fat_level ?? 0,
      raw_text: text,
    }
  } catch {
    throw new Error('Parse error')
  }
}

export async function analyzeMealImage(
  imageBase64: string,
  mimeType: string,
  caption: string,
  goals: Goals,
  profile?: UserProfile | null
): Promise<MealAnalysis & { description: string }> {
  const useMock = import.meta.env.VITE_USE_MOCK === 'true'

  if (useMock) {
    await new Promise((r) => setTimeout(r, 1000))
    return {
      ...mockAnalysis(),
      description: caption || 'وعده‌ی شناسایی‌شده از عکس (mock)',
    }
  }

  const goalLabels: Record<string, string> = {
    lose_weight: 'کاهش وزن',
    maintain: 'حفظ وزن',
    eat_healthier: 'غذای سالم‌تر',
  }
  const goalsText = goals.map((g) => goalLabels[g]).join(' و ')

  let profileContext = ''
  if (profile) {
    const { getTargets } = await import('./profile')
    const targets = getTargets(profile, goals)
    profileContext = `\nاطلاعات کاربر: وزن ${profile.weight_kg}kg، قد ${profile.height_cm}cm، سن ${profile.age}، هدف کالری روزانه: ${targets.cal} کال`
    if (profile.inbody) {
      profileContext += `\nدرصد چربی ${profile.inbody.body_fat_percent}%، توده عضلانی ${profile.inbody.muscle_mass_kg}kg`
    }
  }

  const captionText = caption ? `\nتوضیح اضافه‌ی کاربر: "${caption}"` : ''

  const prompt = `تو یه مربی تغذیه‌ی غیرقضاوتی و صادق هستی که فارسی صحبت می‌کنی.
این عکسِ غذایی است که کاربر خورده.${captionText}
هدف‌های کاربر: ${goalsText}${profileContext}

یه JSON برگردون با این شکل دقیق (بدون markdown، فقط JSON):
{
  "description": "<توصیف کوتاه فارسی از غذای داخل عکس>",
  "calories_estimate": <عدد صحیح>,
  "protein_estimate": <گرم پروتئین، عدد صحیح>,
  "fit_with_goal": "good" | "okay" | "watch_out",
  "fit_sentence": "<یه جمله کوتاه فارسی درباره تناسب این وعده با هدف کاربر>",
  "suggestion": "<یه توصیه کوتاه عملی فارسی>",
  "coaching": "<۲ تا ۳ جمله فارسی — صادق باش: اگه جانک فود بود بگو، بگو چرا مضره، و یه راه‌حل مشخص بده. آب هم یادت نره.>"
}

قوانین:
- description: کوتاه و دقیق، مثل "یه بشقاب چلوکباب با گوجه"
- calories_estimate: تخمین کل کالری بر اساس آنچه در عکس دیده میشه
- fit_with_goal: good اگه با هدف هماهنگه، okay اگه خنثیه، watch_out اگه ناهماهنگه
- coaching باید واقعی و آموزنده باشه — نه شرم‌آور. صادق و رو‌به‌جلو.
- همه متن‌ها فارسی`

  const response = await fetch('/api/claude', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mimeType, data: imageBase64 } },
            { type: 'text', text: prompt },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    console.warn('Claude API error, falling back to mock', response.status)
    return { ...mockAnalysis(), description: caption || 'وعده‌ی شناسایی‌شده از عکس' }
  }

  const data = await response.json()
  try {
    const text: string = data.content[0].text
    const clean = text.replace(/```[a-z]*\n?/g, '').trim()
    const parsed = JSON.parse(clean)
    return { ...parsed, is_mock: false }
  } catch {
    return { ...mockAnalysis(), description: caption || 'وعده‌ی شناسایی‌شده از عکس' }
  }
}

export async function analyzeMeal(description: string, goals: Goals, profile?: UserProfile | null): Promise<MealAnalysis> {
  const useMock = import.meta.env.VITE_USE_MOCK === 'true'

  if (useMock) {
    await new Promise((r) => setTimeout(r, 800))
    return mockAnalysis()
  }

  const goalLabels: Record<string, string> = {
    lose_weight: 'کاهش وزن',
    maintain: 'حفظ وزن',
    eat_healthier: 'غذای سالم‌تر',
  }
  const goalsText = goals.map((g) => goalLabels[g]).join(' و ')

  let profileContext = ''
  if (profile) {
    const { getTargets } = await import('./profile')
    const targets = getTargets(profile, goals)
    profileContext = `\nاطلاعات کاربر: وزن ${profile.weight_kg}kg، قد ${profile.height_cm}cm، سن ${profile.age}، هدف کالری روزانه: ${targets.cal} کال`
    if (profile.inbody) {
      profileContext += `\nدرصد چربی ${profile.inbody.body_fat_percent}%، توده عضلانی ${profile.inbody.muscle_mass_kg}kg`
    }
  }

  const prompt = `تو یه مربی تغذیه‌ی غیرقضاوتی و صادق هستی که فارسی صحبت می‌کنی.
کاربر این رو خورده: "${description}"
هدف‌های کاربر: ${goalsText}${profileContext}

یه JSON برگردون با این شکل دقیق (بدون markdown، فقط JSON):
{
  "calories_estimate": <عدد صحیح>,
  "protein_estimate": <گرم پروتئین، عدد صحیح>,
  "fit_with_goal": "good" | "okay" | "watch_out",
  "fit_sentence": "<یه جمله کوتاه فارسی درباره تناسب این وعده با هدف کاربر>",
  "suggestion": "<یه توصیه کوتاه عملی فارسی — مثل: یه لیوان آب بخور، وعده بعدی پروتئین بیشتر>",
  "coaching": "<۲ تا ۳ جمله فارسی — صادق باش: اگه جانک فود بود بگو، بگو چرا مضره، و یه راه‌حل مشخص بده. مثلاً: این غذا قند پنهان زیادی داره که سریع گرسنه‌ات می‌کنه. بعدش یه پروتئین مثل تخم‌مرغ یا مرغ بخور تا سیر بمونی. آب هم یادت نره.>"
}

قوانین:
- calories_estimate: تخمین کل کالری
- fit_with_goal: good اگه با هدف هماهنگه، okay اگه خنثیه، watch_out اگه ناهماهنگه
- coaching باید واقعی و آموزنده باشه — نه شرم‌آور، نه بیش از حد مثبت. صادق و رو‌به‌جلو.
- همه متن‌ها فارسی`

  const response = await fetch('/api/claude', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    console.warn('Claude API error, falling back to mock', response.status)
    return mockAnalysis()
  }

  const data = await response.json()
  try {
    const text: string = data.content[0].text
    const parsed = JSON.parse(text)
    return { ...parsed, is_mock: false }
  } catch {
    return mockAnalysis()
  }
}
