import { WorkoutProvider } from './context/WorkoutContext';
import { CircuitWorkoutDisplay } from './components/CircuitWorkoutDisplay';
import './App.css';

function App() {
  return (
    <WorkoutProvider>
      <div className="container">
        {/* Header */}
        <header className="header">
          <h1>💪 Flexin</h1>
          <p>Your Personal Workout Companion</p>
        </header>

        {/* Main Workout Area */}
        <main>
          <CircuitWorkoutDisplay />
        </main>
      </div>
    </WorkoutProvider>
  );
}

export default App;
