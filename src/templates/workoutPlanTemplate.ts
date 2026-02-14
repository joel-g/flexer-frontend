import type { WorkoutPlan } from '../types/workout';

// Template for creating new workout plans
// Copy this template and fill in your workout details

export const workoutPlanTemplate: WorkoutPlan = {
  id: 'your-plan-id', // Unique identifier, e.g., 'strength-hypertrophy-6week'
  name: 'Your Plan Name', // e.g., 'Strength & Hypertrophy Program'
  description: 'Brief description of your workout plan and its goals',
  duration: '6 weeks',
  weeks: [
    {
      weekNumber: 1,
      name: 'Foundation Week', // Theme for this week
      description: 'Week 1 focus and progression goals',
      days: [
        {
          id: 'w1-d1-upper', // Format: w{week}-d{day}-{type}
          name: 'Upper Body Strength',
          description: 'Focus on upper body compound movements',
          estimatedDuration: 45, // minutes
          exercises: [
            {
              id: 'w1-d1-e1',
              name: 'Push-ups',
              sets: 3,
              reps: '8-12', // Can be ranges, exact numbers, time, or AMRAP
              loadType: 'bodyweight',
              weight: 'bodyweight', // 'bodyweight', 'light dumbbells', 'previous + 5 lbs', etc.
              restSeconds: 60,
              instructions: 'Keep straight line from head to heels, lower chest to floor',
              notes: 'Modify on knees if needed' // Optional
            },
            {
              id: 'w1-d1-e2',
              name: 'Bent-over Rows',
              sets: 3,
              reps: '10-12',
              loadType: 'external_weight',
              weight: 'light dumbbells',
              restSeconds: 60,
              instructions: 'Hinge at hips, pull elbows back, squeeze shoulder blades'
            }
            // Add more exercises...
          ]
        },
        {
          id: 'w1-d2-lower',
          name: 'Lower Body Strength',
          description: 'Focus on legs and glutes',
          estimatedDuration: 40,
          exercises: [
            {
              id: 'w1-d2-e1',
              name: 'Squats',
              sets: 3,
              reps: '12-15',
              loadType: 'bodyweight',
              weight: 'bodyweight',
              restSeconds: 60,
              instructions: 'Feet hip-width apart, sit back, knees track over toes'
            }
            // Add more exercises...
          ]
        }
        // Add more days (typically 3-4 per week)...
      ]
    },
    // Add weeks 2-6...
    {
      weekNumber: 2,
      name: 'Progressive Week',
      description: 'Increase intensity and add complexity',
      days: [
        // Copy and modify from week 1, progressively increasing difficulty
      ]
    }
    // Continue for weeks 3-6...
  ]
};

/*
CLAUDE PROMPT TEMPLATE:
======================

Create a 6-week [type of training] workout plan. Structure it as a TypeScript object following the format above.

Requirements:
- 6 weeks total, with clear progression
- [3-4] workout days per week
- Each workout should have [4-6] exercises
- Focus on [your specific goals: strength, hypertrophy, endurance, etc.]
- Equipment available: [bodyweight only / home gym / full gym]
- Experience level: [beginner / intermediate / advanced]
- Time per workout: [30-60] minutes

For each exercise, include:
- Sets and reps (can use ranges like "8-12" or time like "30 sec")
- loadType: one of "external_weight", "bodyweight", "assisted", "band", "machine_level", "timed", "distance"
- Weight recommendations (descriptive like "bodyweight", "light dumbbells", "challenging weight")
- Rest periods in seconds
- Clear form instructions
- Any important notes or modifications

Progressive elements to include:
- Week 1-2: Foundation and form focus
- Week 3-4: Increased intensity/volume
- Week 5-6: Peak challenge and strength

Please format as a complete TypeScript object that I can copy into my workoutConfig.ts file.

EXAMPLE PROGRESSION IDEAS:
- Increase reps: Week 1 (8-10) → Week 6 (12-15)
- Add complexity: Push-ups → Diamond push-ups → Archer push-ups
- Increase sets: 3 sets → 4 sets
- Decrease rest: 90 sec → 60 sec
- Add weight: Bodyweight → Light weight → Heavier weight
*/
