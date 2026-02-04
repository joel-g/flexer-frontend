import { WorkoutProvider } from '../context/WorkoutContext';
import { CircuitWorkoutDisplay } from '../components/CircuitWorkoutDisplay';
import { ResponsiveLayout } from '../components/ResponsiveLayout';

export function WorkoutPage() {
  return (
    <WorkoutProvider>
      <ResponsiveLayout>
        <div className="workout-page">
          <CircuitWorkoutDisplay />
        </div>
      </ResponsiveLayout>
    </WorkoutProvider>
  );
}
