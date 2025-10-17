# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

# 💪 Flexin - Personal Workout App

A mobile-first React app designed to replace Volt Athletic functionality for personal use. Built with TypeScript and Vite for fast development and optimal performance.

## Features

- **Mobile-First Design**: Optimized for mobile devices with touch-friendly interface
- **Build-Time Configuration**: Workouts are configured at build time using TypeScript files
- **Sequential Workout Navigation**: Navigate through workouts one at a time
- **Progress Tracking**: Automatic progress saving with local storage
- **6-Week Workout Plans**: Designed to work with Claude-generated workout plans
- **Exercise Details**: Comprehensive exercise information including sets, reps, weight, and instructions

## Getting Started

### Prerequisites

- Node.js 20.19+ or 22.12+ (required by Vite)
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd flexin

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173/`

### Building for Production

```bash
npm run build
```

## Project Structure

```
src/
├── components/          # React components
│   ├── ExerciseCard.tsx    # Individual exercise display
│   └── WorkoutDisplay.tsx  # Main workout interface
├── context/            # React context providers
│   └── WorkoutContext.tsx  # Workout state management
├── data/              # Configuration files
│   └── workoutConfig.ts    # Workout plans configuration
├── types/             # TypeScript type definitions
│   └── workout.ts         # Workout-related types
├── App.tsx            # Main app component
├── index.css          # Global styles (mobile-first)
└── main.tsx           # App entry point
```

## Adding New Workout Plans

### 1. Create Your Workout Plan

Edit `src/data/workoutConfig.ts` to add new workout plans. The structure follows this hierarchy:

- **WorkoutPlan**: The overall 6-week program
- **WorkoutWeek**: Individual weeks within the plan
- **WorkoutDay**: Individual workout sessions
- **Exercise**: Individual exercises with sets, reps, etc.

### 2. Workout Plan Template

Here's a template for creating new workout plans with Claude:

```typescript
export const myNewWorkoutPlan: WorkoutPlan = {
  id: 'unique-plan-id',
  name: 'Plan Name',
  description: 'Brief description of the workout plan goals and focus',
  duration: '6 weeks',
  weeks: [
    {
      weekNumber: 1,
      name: 'Week 1 Theme',
      description: 'Week 1 focus and goals',
      days: [
        {
          id: 'w1-d1-identifier',
          name: 'Workout Day Name',
          description: 'What this workout focuses on',
          estimatedDuration: 45, // minutes
          exercises: [
            {
              id: 'unique-exercise-id',
              name: 'Exercise Name',
              sets: 3,
              reps: '8-12', // Can be ranges, time, or AMRAP
              weight: 'bodyweight', // or 'light dumbbells', '60 lbs', etc.
              restSeconds: 60,
              instructions: 'Clear, concise form instructions',
              notes: 'Optional additional notes'
            }
            // ... more exercises
          ]
        }
        // ... more days
      ]
    }
    // ... more weeks (typically 6 total)
  ]
};
```

### 3. Exercise Guidelines

When creating exercises, include:

- **Sets**: Number of sets to perform
- **Reps**: Can be exact numbers, ranges (8-12), time (30 sec), or AMRAP
- **Weight**: Descriptive weights like "bodyweight", "light dumbbells", "previous + 5 lbs"
- **Rest**: Rest time in seconds between sets
- **Instructions**: Brief form cues and technique notes
- **Notes**: Optional additional information or modifications

### 4. Update Configuration

After creating your workout plan, update the `workoutConfig` object:

```typescript
export const workoutConfig = {
  currentPlan: myNewWorkoutPlan, // Set your new plan as current
  plans: [sampleWorkoutPlan, myNewWorkoutPlan] // Add to available plans
};
```

## Claude Prompt Template

Use this prompt with Claude to generate workout plans:

```
Create a 6-week workout plan for [your fitness goals]. Structure it as a TypeScript object following this format:

- 6 weeks total
- 3-4 workout days per week
- Each workout should have 4-6 exercises
- Include sets, reps, weight recommendations, rest periods, and form instructions
- Focus on [specific goals like strength, endurance, muscle building, etc.]
- Exercises should be [bodyweight/gym equipment/home equipment] based
- Each workout should take 30-60 minutes

Please format the response as a complete TypeScript object that I can copy into my workoutConfig.ts file.
```

## Mobile Optimization

The app is designed mobile-first with:

- Touch-friendly button sizes (minimum 44px)
- Optimized font sizes for mobile reading
- Safe area support for devices with notches
- Landscape orientation adjustments
- Maximum width constraint for readability

## Data Persistence

- Workout progress is automatically saved to localStorage
- Progress includes current week, day, and completed workouts
- Data persists across browser sessions
- Reset functionality available if needed

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

### Adding Features

The app is designed to be easily extensible. Common additions might include:

- Multiple workout plans selection
- Timer functionality for rest periods
- Exercise videos or images
- Progress statistics
- Export functionality
- Social sharing

## Browser Support

- Modern browsers with ES2020+ support
- Mobile Safari (iOS 14+)
- Chrome Mobile (Android 8+)
- Progressive Web App ready

## License

This project is for personal use. Feel free to modify and adapt for your own workout needs.
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
