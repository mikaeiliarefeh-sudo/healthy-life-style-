import { useState } from 'react'
import type { Goals, MealLog } from './lib/types'
import { getGoals, setGoals, getTodayData } from './lib/storage'
import GoalSetup from './components/GoalSetup'
import MealLogger from './components/MealLogger'

function App() {
  const [goals, setGoalsState] = useState<Goals | null>(() => getGoals())
  const [meals, setMeals] = useState<MealLog[]>(() => getTodayData().meals)

  const handleGoalsSelected = (g: Goals) => {
    setGoals(g)
    setGoalsState(g)
  }

  const handleMealAdded = (meal: MealLog) => {
    setMeals((prev) => [...prev, meal])
  }

  const handleChangeGoal = () => {
    setGoalsState(null)
  }

  if (!goals) {
    return <GoalSetup onGoalsSelected={handleGoalsSelected} />
  }

  return (
    <MealLogger
      goals={goals}
      meals={meals}
      onMealAdded={handleMealAdded}
      onChangeGoal={handleChangeGoal}
    />
  )
}

export default App
