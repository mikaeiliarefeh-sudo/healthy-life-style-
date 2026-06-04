import { useState } from 'react'
import type { Goals, MealLog, UserProfile } from './lib/types'
import { getGoals, setGoals, getTodayData, getProfile, setProfile } from './lib/storage'
import GoalSetup from './components/GoalSetup'
import ProfileSetup from './components/ProfileSetup'
import MealLogger from './components/MealLogger'

type Screen = 'main' | 'profile'

function App() {
  const [goals, setGoalsState] = useState<Goals | null>(() => getGoals())
  const [profile, setProfileState] = useState<UserProfile | null>(() => getProfile())
  const [profileSeen, setProfileSeen] = useState<boolean>(() => getProfile() !== null || localStorage.getItem('qaliz_profile_seen') === 'true')
  const [meals, setMeals] = useState<MealLog[]>(() => getTodayData().meals)
  const [screen, setScreen] = useState<Screen>('main')

  const handleGoalsSelected = (g: Goals) => {
    setGoals(g)
    setGoalsState(g)
  }

  const handleProfileSaved = (p: UserProfile) => {
    setProfile(p)
    setProfileState(p)
    setProfileSeen(true)
    localStorage.setItem('qaliz_profile_seen', 'true')
    setScreen('main')
  }

  const handleProfileSkipped = () => {
    setProfileSeen(true)
    localStorage.setItem('qaliz_profile_seen', 'true')
    setScreen('main')
  }

  const handleMealAdded = (meal: MealLog) => {
    setMeals((prev) => [...prev, meal])
  }

  const handleChangeGoal = () => {
    setGoalsState(null)
  }

  const handleOpenProfile = () => {
    setScreen('profile')
  }

  if (!goals) {
    return <GoalSetup onGoalsSelected={handleGoalsSelected} />
  }

  if ((!profileSeen) || screen === 'profile') {
    return (
      <ProfileSetup
        onSaved={handleProfileSaved}
        onSkip={handleProfileSkipped}
      />
    )
  }

  return (
    <MealLogger
      goals={goals}
      meals={meals}
      profile={profile}
      onMealAdded={handleMealAdded}
      onChangeGoal={handleChangeGoal}
      onOpenProfile={handleOpenProfile}
    />
  )
}

export default App
