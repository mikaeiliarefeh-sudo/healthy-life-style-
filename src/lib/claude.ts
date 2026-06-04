import type { Goals, MealAnalysis } from './types'

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

export async function analyzeMeal(description: string, goals: Goals): Promise<MealAnalysis> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined
  const useMock = import.meta.env.VITE_USE_MOCK === 'true'

  if (!apiKey || useMock) {
    await new Promise((r) => setTimeout(r, 800))
    return mockAnalysis()
  }

  const goalLabels: Record<string, string> = {
    lose_weight: 'کاهش وزن',
    maintain: 'حفظ وزن',
    eat_healthier: 'غذای سالم‌تر',
  }
  const goalsText = goals.map((g) => goalLabels[g]).join(' و ')

  const prompt = `تو یه مربی تغذیه‌ی غیرقضاوتی و صادق هستی که فارسی صحبت می‌کنی.
کاربر این رو خورده: "${description}"
هدف‌های کاربر: ${goalsText}

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

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
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
