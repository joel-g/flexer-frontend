import { WorkoutProvider } from '../context/WorkoutContext';
import { CircuitWorkoutDisplay } from '../components/CircuitWorkoutDisplay';

export function WorkoutPage() {
  return (
    <WorkoutProvider>
      <div className="workout-page">
        <CircuitWorkoutDisplay />
      </div>
    </WorkoutProvider>
  );
}
