import type { UserProfile, Goals } from './types'

// Mifflin-St Jeor BMR formula × 1.4 (lightly active)
export function calcTDEE(profile: UserProfile): number {
  let bmr: number
  if (profile.gender === 'male') {
    bmr = 10 * profile.weight_kg + 6.25 * profile.height_cm - 5 * profile.age + 5
  } else {
    bmr = 10 * profile.weight_kg + 6.25 * profile.height_cm - 5 * profile.age - 161
  }
  return Math.round(bmr * 1.4)
}

export function getTargets(
  profile: UserProfile | null,
  goals: Goals,
): { cal: number; protein: number } {
  const primaryGoal = goals[0]

  if (!profile) {
    const fallback: Record<string, { cal: number; protein: number }> = {
      lose_weight: { cal: 1600, protein: 80 },
      maintain: { cal: 2000, protein: 70 },
      eat_healthier: { cal: 2000, protein: 75 },
    }
    return fallback[primaryGoal] ?? { cal: 2000, protein: 70 }
  }

  // Use InBody BMR if available, otherwise Mifflin formula
  const tdee = profile.inbody
    ? Math.round(profile.inbody.bmr * 1.4)
    : calcTDEE(profile)

  const w = profile.weight_kg

  switch (primaryGoal) {
    case 'lose_weight':
      return { cal: Math.max(1200, tdee - 400), protein: Math.round(w * 1.6) }
    case 'maintain':
      return { cal: tdee, protein: Math.round(w * 1.4) }
    case 'eat_healthier':
    default:
      return { cal: tdee, protein: Math.round(w * 1.5) }
  }
}
