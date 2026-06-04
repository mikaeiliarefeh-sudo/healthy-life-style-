import { useState } from 'react'
import type { Goal, MealLog } from './lib/types'
import { getGoal, setGoal, getTodayData } from './lib/storage'
import GoalSetup from './components/GoalSetup'
import MealLogger from './components/MealLogger'

function App() {
  const [goal, setGoalState] = useState<Goal | null>(() => getGoal())
  const [meals, setMeals] = useState<MealLog[]>(() => getTodayData().meals)

  const handleGoalSelected = (g: Goal) => {
    setGoal(g)
    setGoalState(g)
  }

  const handleMealAdded = (meal: MealLog) => {
    setMeals((prev) => [...prev, meal])
  }

  const handleChangeGoal = () => {
    setGoalState(null)
  }

  if (!goal) {
    return <GoalSetup onGoalSelected={handleGoalSelected} />
  }

  return (
    <MealLogger
      goal={goal}
      meals={meals}
      onMealAdded={handleMealAdded}
      onChangeGoal={handleChangeGoal}
    />
  )
}

export default App
