import type { Goal, MealAnalysis } from './types'

const MOCK_SUGGESTIONS: Record<Goal, string[]> = {
  lose_weight: [
    'سعی کن وعده‌ی بعدی را با سبزیجات بیشتری همراه کنی.',
    'نوشیدن آب قبل از وعده می‌تواند کمک‌کننده باشد.',
    'اگر دوباره گرسنه شدی، یک میان‌وعده‌ی سبک مثل سیب مناسب است.',
  ],
  maintain: [
    'این وعده به خوبی با هدف تعادل‌ات هماهنگ است.',
    'تنوع در رنگ‌های غذایی می‌تواند ریزمغذی‌های بیشتری برایت فراهم کند.',
    'آفرین! ادامه بده.',
  ],
  eat_healthier: [
    'اضافه کردن کمی سبزی تازه به این وعده ایده‌ی خوبی است.',
    'پروتئین خوبی داشتی — بسیار عالی!',
    'هر قدم کوچک به سمت غذای سالم‌تر ارزشمند است.',
  ],
}

const FIT_SENTENCES: Record<'good' | 'okay' | 'watch_out', string[]> = {
  good: [
    'این وعده با هدفت خیلی خوب هماهنگ است! 🌿',
    'انتخاب مناسبی داشتی.',
  ],
  okay: [
    'این وعده در محدوده‌ی قابل‌قبول است.',
    'بد نیست، می‌توانی کمی بهترش کنی.',
  ],
  watch_out: [
    'این وعده کمی سنگین‌تر بود — ایرادی ندارد، بقیه‌ی روز را متعادل‌تر ادامه بده.',
    'گاهی چنین وعده‌هایی طبیعی است، فقط وعده‌ی بعدی را سبک‌تر کن.',
  ],
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function mockAnalysis(goal: Goal): MealAnalysis {
  const calories = 350 + Math.floor(Math.random() * 400)
  const protein = 12 + Math.floor(Math.random() * 25)
  const fits: Array<'good' | 'okay' | 'watch_out'> = ['good', 'okay', 'watch_out']
  const fit_with_goal = fits[Math.floor(Math.random() * fits.length)]

  return {
    calories_estimate: calories,
    protein_estimate: protein,
    fit_with_goal,
    fit_sentence: pickRandom(FIT_SENTENCES[fit_with_goal]),
    suggestion: pickRandom(MOCK_SUGGESTIONS[goal]),
    is_mock: true,
  }
}

export async function analyzeMeal(
  description: string,
  goal: Goal
): Promise<MealAnalysis> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined

  if (!apiKey) {
    // Simulate a short network delay for realism
    await new Promise((r) => setTimeout(r, 800))
    return mockAnalysis(goal)
  }

  const goalLabel: Record<Goal, string> = {
    lose_weight: 'lose weight',
    maintain: 'maintain current weight',
    eat_healthier: 'eat healthier',
  }

  const prompt = `You are a non-judgmental, supportive nutrition coach. The user ate: "${description}". Their goal: ${goalLabel[goal]}.

Return ONLY valid JSON (no markdown, no explanation) with this exact shape:
{
  "calories_estimate": <integer>,
  "protein_estimate": <integer>,
  "fit_with_goal": "good" | "okay" | "watch_out",
  "fit_sentence": "<one short Persian-friendly sentence about how this meal fits their goal>",
  "suggestion": "<one gentle, actionable suggestion in Persian-friendly tone>"
}

Rules:
- calories_estimate: approximate total calories as integer
- protein_estimate: approximate grams of protein as integer
- fit_with_goal: "good" if well aligned, "okay" if neutral, "watch_out" if heavy/misaligned — never shame the user
- fit_sentence and suggestion: calm, non-judgmental, in English (will be shown as-is)`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    console.warn('Claude API error, falling back to mock', response.status)
    return mockAnalysis(goal)
  }

  const data = await response.json()
  try {
    const text: string = data.content[0].text
    const parsed = JSON.parse(text)
    return { ...parsed, is_mock: false }
  } catch {
    console.warn('Failed to parse Claude response, falling back to mock')
    return mockAnalysis(goal)
  }
}
