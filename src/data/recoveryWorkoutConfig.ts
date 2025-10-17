import type { WorkoutPlan } from '../types/workout';

// 6-Week Progressive Workout Plan: Post-Shoulder Injury Recovery & Muscle Rebuilding
export const recoveryWorkoutPlan: WorkoutPlan = {
  id: 'shoulder-recovery-6week',
  name: 'Post-Shoulder Injury Recovery',
  description: 'Progressive 6-week plan for shoulder recovery and muscle rebuilding with emphasis on safe movement patterns and gradual loading.',
  duration: '6 weeks',
  weeks: [
    // WEEKS 1-2: Foundation Phase
    {
      weekNumber: 1,
      name: 'Foundation Phase (Week 1)',
      description: 'Light weights, high control, movement pattern establishment',
      days: [
        {
          id: 'w1-d1-upper-a',
          name: 'Upper Body A (Shoulder-Safe)',
          description: 'Focus on controlled movements with light weights',
          estimatedDuration: 45,
          exercises: [
            {
              id: 'w1-d1-e1',
              name: 'Warm-up',
              sets: 1,
              reps: '5 min',
              weight: 'bodyweight',
              instructions: '5 minutes arm circles, band pull-aparts (15 reps), scapular wall slides (10 reps)'
            },
            {
              id: 'w1-d1-e2',
              name: 'Incline Push-ups',
              sets: 3,
              reps: '12',
              weight: 'bodyweight',
              restSeconds: 60,
              instructions: 'Hands on bench, maintain straight line from head to heels'
            },
            {
              id: 'w1-d1-e3',
              name: 'Dumbbell Floor Press',
              sets: 3,
              reps: '10',
              weight: '50% perceived max',
              restSeconds: 90,
              instructions: 'Limits shoulder extension, control the movement'
            },
            {
              id: 'w1-d1-e4',
              name: 'Neutral Grip Dumbbell Rows',
              sets: 3,
              reps: '12 each arm',
              weight: 'light dumbbells',
              restSeconds: 60,
              instructions: 'Single arm, maintain neutral spine'
            },
            {
              id: 'w1-d1-e5',
              name: 'Band Face Pulls',
              sets: 3,
              reps: '15',
              weight: 'Peloton bands',
              restSeconds: 45,
              instructions: 'Pull to face level, squeeze shoulder blades'
            },
            {
              id: 'w1-d1-e6',
              name: 'Dumbbell Lateral Raises',
              sets: 3,
              reps: '10',
              weight: 'very light',
              restSeconds: 60,
              instructions: 'Perfect form, control the movement, stop at shoulder height'
            },
            {
              id: 'w1-d1-e7',
              name: 'Band External Rotations',
              sets: 3,
              reps: '15 each arm',
              weight: 'light band',
              restSeconds: 45,
              instructions: 'Keep elbow at side, rotate outward slowly'
            }
          ]
        },
        {
          id: 'w1-d2-core',
          name: 'Core & Conditioning',
          description: 'Core stability and light conditioning',
          estimatedDuration: 35,
          exercises: [
            {
              id: 'w1-d2-e1',
              name: 'Dead Bugs',
              sets: 3,
              reps: '12 each side',
              weight: 'bodyweight',
              restSeconds: 45,
              instructions: 'Keep lower back pressed to floor, slow controlled movement'
            },
            {
              id: 'w1-d2-e2',
              name: 'Plank',
              sets: 3,
              reps: '30-45 seconds',
              weight: 'bodyweight',
              restSeconds: 60,
              instructions: 'Straight line from head to heels, engage core'
            },
            {
              id: 'w1-d2-e3',
              name: 'Bird Dogs',
              sets: 3,
              reps: '10 each side',
              weight: 'bodyweight',
              restSeconds: 45,
              instructions: 'Opposite arm and leg, hold for 2 seconds'
            },
            {
              id: 'w1-d2-e4',
              name: 'Pallof Press',
              sets: 3,
              reps: '12 each side',
              weight: 'bands',
              restSeconds: 60,
              instructions: 'Resist rotation, press straight out from chest'
            },
            {
              id: 'w1-d2-e5',
              name: 'Hollow Body Hold',
              sets: 3,
              reps: '20 seconds',
              weight: 'bodyweight',
              restSeconds: 45,
              instructions: 'Press lower back to floor, hold position'
            },
            {
              id: 'w1-d2-e6',
              name: 'Jump Box Step-ups',
              sets: 3,
              reps: '15 each leg',
              weight: 'bodyweight',
              restSeconds: 60,
              instructions: 'Step up with control, full hip extension at top'
            },
            {
              id: 'w1-d2-e7',
              name: 'Easy Run Finisher',
              sets: 1,
              reps: '20 minutes',
              weight: 'bodyweight',
              instructions: 'Easy pace, finish feeling refreshed'
            }
          ]
        },
        {
          id: 'w1-d3-lower',
          name: 'Lower Body & Posterior Chain',
          description: 'Lower body strength with posterior chain focus',
          estimatedDuration: 40,
          exercises: [
            {
              id: 'w1-d3-e1',
              name: 'Goblet Squats',
              sets: 4,
              reps: '12',
              weight: 'single dumbbell',
              restSeconds: 90,
              instructions: 'Hold dumbbell at chest, squat below parallel'
            },
            {
              id: 'w1-d3-e2',
              name: 'Romanian Deadlifts',
              sets: 3,
              reps: '12',
              weight: 'dumbbells',
              restSeconds: 90,
              instructions: 'Hinge at hips, keep back straight, feel hamstring stretch'
            },
            {
              id: 'w1-d3-e3',
              name: 'Bulgarian Split Squats',
              sets: 3,
              reps: '10 each leg',
              weight: 'bodyweight',
              restSeconds: 60,
              instructions: 'Rear foot elevated, front leg does the work'
            },
            {
              id: 'w1-d3-e4',
              name: 'Jump Box Step-downs',
              sets: 3,
              reps: '10 each leg',
              weight: 'bodyweight',
              restSeconds: 60,
              instructions: 'Eccentric focus, control the descent slowly'
            },
            {
              id: 'w1-d3-e5',
              name: 'Single-Leg Glute Bridges',
              sets: 3,
              reps: '12 each leg',
              weight: 'bodyweight',
              restSeconds: 45,
              instructions: 'Squeeze glutes at top, hold for 1 second'
            },
            {
              id: 'w1-d3-e6',
              name: 'Standing Calf Raises',
              sets: 3,
              reps: '20',
              weight: 'bodyweight',
              restSeconds: 45,
              instructions: 'On box edge for full range of motion'
            }
          ]
        },
        {
          id: 'w1-d4-recovery',
          name: 'Active Recovery',
          description: 'Light movement and mobility',
          estimatedDuration: 30,
          exercises: [
            {
              id: 'w1-d4-e1',
              name: 'Active Recovery Day',
              sets: 1,
              reps: '30 minutes',
              weight: 'bodyweight',
              instructions: 'Light cardio, yoga, or easy walk. Keep it easy and listen to your body!'
            }
          ]
        },
        {
          id: 'w1-d5-upper-b',
          name: 'Upper Body B',
          description: 'Second upper body session with different movement patterns',
          estimatedDuration: 40,
          exercises: [
            {
              id: 'w1-d5-e1',
              name: 'Push-ups',
              sets: 3,
              reps: '8-10',
              weight: 'bodyweight',
              restSeconds: 60,
              instructions: 'Modify on knees if needed, focus on perfect form'
            },
            {
              id: 'w1-d5-e2',
              name: 'Single-Arm Dumbbell Press',
              sets: 3,
              reps: '10 each arm',
              weight: 'light dumbbells',
              restSeconds: 60,
              instructions: 'On bench, unilateral loading for core stability'
            },
            {
              id: 'w1-d5-e3',
              name: 'Renegade Rows',
              sets: 3,
              reps: '8 each arm',
              weight: 'light dumbbells',
              restSeconds: 90,
              instructions: 'Plank position, row one arm at a time'
            },
            {
              id: 'w1-d5-e4',
              name: 'Band Pull-aparts',
              sets: 3,
              reps: '20',
              weight: 'light band',
              restSeconds: 45,
              instructions: 'Keep arms straight, pull band apart at chest level'
            },
            {
              id: 'w1-d5-e5',
              name: 'Dumbbell Bicep Curls',
              sets: 3,
              reps: '12',
              weight: 'light dumbbells',
              restSeconds: 60,
              instructions: 'Control the negative, squeeze at the top'
            },
            {
              id: 'w1-d5-e6',
              name: 'Overhead Tricep Extension',
              sets: 3,
              reps: '10',
              weight: 'light weight',
              restSeconds: 60,
              instructions: 'Careful with shoulder position, start very light'
            }
          ]
        },
        {
          id: 'w1-d6-core-circuit',
          name: 'Core Circuit',
          description: 'Circuit-style core training',
          estimatedDuration: 25,
          exercises: [
            {
              id: 'w1-d6-e1',
              name: 'Bicycle Crunches',
              sets: 3,
              reps: '20',
              weight: 'bodyweight',
              restSeconds: 30,
              instructions: 'Controlled movement, bring elbow to opposite knee'
            },
            {
              id: 'w1-d6-e2',
              name: 'Russian Twists',
              sets: 3,
              reps: '20',
              weight: 'medicine ball',
              restSeconds: 30,
              instructions: 'Rotate side to side, keep core engaged'
            },
            {
              id: 'w1-d6-e3',
              name: 'Mountain Climbers',
              sets: 3,
              reps: '30 seconds',
              weight: 'bodyweight',
              restSeconds: 30,
              instructions: 'Fast alternating knees to chest from plank'
            },
            {
              id: 'w1-d6-e4',
              name: 'Side Plank',
              sets: 3,
              reps: '30 seconds each side',
              weight: 'bodyweight',
              restSeconds: 45,
              instructions: 'Hold straight line, stack shoulders and hips'
            },
            {
              id: 'w1-d6-e5',
              name: 'Medicine Ball Slams',
              sets: 3,
              reps: '15',
              weight: 'medicine ball',
              restSeconds: 60,
              instructions: 'Explosive slam down, engage entire core'
            },
            {
              id: 'w1-d6-e6',
              name: 'Lying Leg Raises',
              sets: 3,
              reps: '12',
              weight: 'bodyweight',
              restSeconds: 45,
              instructions: 'Keep lower back pressed to floor, control the movement'
            }
          ]
        },
        {
          id: 'w1-d7-run',
          name: 'Long Run or Rest',
          description: 'Aerobic base or complete rest',
          estimatedDuration: 60,
          exercises: [
            {
              id: 'w1-d7-e1',
              name: 'Long Run or Complete Rest',
              sets: 1,
              reps: '45-60 minutes or rest',
              weight: 'bodyweight',
              instructions: 'Easy pace long run or take complete rest day - listen to your body'
            }
          ]
        }
      ]
    },
    // WEEK 2 - Foundation Phase continues
    {
      weekNumber: 2,
      name: 'Foundation Phase (Week 2)',
      description: 'Continue building movement patterns with slight progression',
      days: [
        {
          id: 'w2-d1-upper-a',
          name: 'Upper Body A (Shoulder-Safe)',
          description: 'Slight progression from Week 1',
          estimatedDuration: 45,
          exercises: [
            {
              id: 'w2-d1-e1',
              name: 'Incline Push-ups',
              sets: 3,
              reps: '15',
              weight: 'bodyweight',
              restSeconds: 60,
              instructions: 'Increase reps from Week 1, maintain perfect form'
            },
            {
              id: 'w2-d1-e2',
              name: 'Dumbbell Floor Press',
              sets: 3,
              reps: '12',
              weight: '55% perceived max',
              restSeconds: 90,
              instructions: 'Slight weight increase, maintain control'
            },
            {
              id: 'w2-d1-e3',
              name: 'Neutral Grip Dumbbell Rows',
              sets: 3,
              reps: '15 each arm',
              weight: 'light-moderate dumbbells',
              restSeconds: 60,
              instructions: 'Slight weight or rep increase'
            },
            {
              id: 'w2-d1-e4',
              name: 'Band Face Pulls',
              sets: 3,
              reps: '18',
              weight: 'Peloton bands',
              restSeconds: 45,
              instructions: 'Increase reps, focus on quality movement'
            },
            {
              id: 'w2-d1-e5',
              name: 'Dumbbell Lateral Raises',
              sets: 3,
              reps: '12',
              weight: 'light weight',
              restSeconds: 60,
              instructions: 'Slight increase in reps or weight'
            },
            {
              id: 'w2-d1-e6',
              name: 'Band External Rotations',
              sets: 3,
              reps: '18 each arm',
              weight: 'light band',
              restSeconds: 45,
              instructions: 'Increase reps, maintain control'
            }
          ]
        }
        // Additional Week 2 days would follow similar progression pattern...
      ]
    },
    // WEEKS 3-4: Building Phase
    {
      weekNumber: 3,
      name: 'Building Phase (Week 3)',
      description: 'Moderate weights, adding volume and complexity',
      days: [
        {
          id: 'w3-d1-upper-a',
          name: 'Upper Body A',
          description: 'Increased intensity with standard movements',
          estimatedDuration: 50,
          exercises: [
            {
              id: 'w3-d1-e1',
              name: 'Standard Push-ups',
              sets: 3,
              reps: '12-15',
              weight: 'bodyweight',
              restSeconds: 60,
              instructions: 'Progress to full push-ups from incline'
            },
            {
              id: 'w3-d1-e2',
              name: 'Dumbbell Bench Press',
              sets: 4,
              reps: '10',
              weight: 'increase 10-15%',
              restSeconds: 90,
              instructions: 'Move to bench press with increased weight'
            },
            {
              id: 'w3-d1-e3',
              name: 'Single-Arm Dumbbell Rows',
              sets: 4,
              reps: '10 each arm',
              weight: 'moderate dumbbells',
              restSeconds: 60,
              instructions: 'Increase weight and add a set'
            },
            {
              id: 'w3-d1-e4',
              name: 'Incline Dumbbell Press',
              sets: 3,
              reps: '10',
              weight: 'moderate dumbbells',
              restSeconds: 90,
              instructions: 'New exercise - start moderate weight'
            },
            {
              id: 'w3-d1-e5',
              name: 'Face Pulls',
              sets: 3,
              reps: '15',
              weight: 'bands or dumbbells',
              restSeconds: 45,
              instructions: 'Can progress to dumbbell rear delt flyes'
            },
            {
              id: 'w3-d1-e6',
              name: 'Lateral Raise Superset',
              sets: 3,
              reps: '12 each movement',
              weight: 'light-moderate',
              restSeconds: 90,
              instructions: 'Lateral raises immediately followed by front raises'
            }
          ]
        }
        // Additional Week 3-4 workouts...
      ]
    },
    // WEEKS 5-6: Strength & Definition Phase
    {
      weekNumber: 5,
      name: 'Strength & Definition (Week 5)',
      description: 'Peak intensity with focus on strength and muscle definition',
      days: [
        {
          id: 'w5-d1-upper-a',
          name: 'Upper Body A (Hypertrophy Focus)',
          description: 'Maximum intensity with focus on muscle building',
          estimatedDuration: 55,
          exercises: [
            {
              id: 'w5-d1-e1',
              name: 'Push-ups',
              sets: 3,
              reps: '15-20',
              weight: 'bodyweight',
              restSeconds: 60,
              instructions: 'High rep range for endurance and definition'
            },
            {
              id: 'w5-d1-e2',
              name: 'Dumbbell Bench Press',
              sets: 4,
              reps: '8',
              weight: 'heavy',
              restSeconds: 120,
              instructions: 'Heavy weight, lower rep range for strength'
            },
            {
              id: 'w5-d1-e3',
              name: 'Incline Dumbbell Press',
              sets: 3,
              reps: '10',
              weight: 'moderate-heavy',
              restSeconds: 90,
              instructions: 'Focus on upper chest development'
            },
            {
              id: 'w5-d1-e4',
              name: 'Dumbbell Flyes',
              sets: 3,
              reps: '12',
              weight: 'light-moderate',
              restSeconds: 60,
              instructions: 'Control the stretch, focus on chest activation'
            },
            {
              id: 'w5-d1-e5',
              name: 'Bent-Over Dumbbell Rows',
              sets: 4,
              reps: '8',
              weight: 'heavy',
              restSeconds: 90,
              instructions: 'Heavy weight for back strength'
            },
            {
              id: 'w5-d1-e6',
              name: 'Face Pulls',
              sets: 4,
              reps: '20',
              weight: 'moderate',
              restSeconds: 45,
              instructions: 'High reps for rear delt endurance'
            },
            {
              id: 'w5-d1-e7',
              name: 'Lateral Raise Drop Set',
              sets: 3,
              reps: '12 heavy + 12 medium + 12 light',
              weight: 'varied',
              restSeconds: 90,
              instructions: 'Start heavy, drop weight twice without rest'
            }
          ]
        }
        // Additional Week 5-6 workouts would continue the progression...
      ]
    },
    // Week 6 would continue with similar structure
    {
      weekNumber: 6,
      name: 'Strength & Definition (Week 6)',
      description: 'Peak performance week with maximum intensity',
      days: [
        {
          id: 'w6-d1-upper-a',
          name: 'Upper Body A (Peak Week)',
          description: 'Maximum intensity and volume for peak results',
          estimatedDuration: 60,
          exercises: [
            {
              id: 'w6-d1-e1',
              name: 'Push-ups',
              sets: 4,
              reps: '20-25',
              weight: 'bodyweight',
              restSeconds: 60,
              instructions: 'Peak rep range, perfect form throughout'
            },
            {
              id: 'w6-d1-e2',
              name: 'Dumbbell Bench Press',
              sets: 5,
              reps: '6-8',
              weight: 'heaviest manageable',
              restSeconds: 120,
              instructions: 'Peak strength - heaviest weight with good form'
            },
            {
              id: 'w6-d1-e3',
              name: 'Incline Dumbbell Press',
              sets: 4,
              reps: '8-10',
              weight: 'heavy',
              restSeconds: 90,
              instructions: 'Peak intensity for upper chest'
            },
            {
              id: 'w6-d1-e4',
              name: 'Dumbbell Flyes',
              sets: 4,
              reps: '10-12',
              weight: 'moderate',
              restSeconds: 60,
              instructions: 'Perfect form, maximum muscle activation'
            },
            {
              id: 'w6-d1-e5',
              name: 'Bent-Over Dumbbell Rows',
              sets: 5,
              reps: '6-8',
              weight: 'heaviest manageable',
              restSeconds: 120,
              instructions: 'Peak back strength development'
            },
            {
              id: 'w6-d1-e6',
              name: 'Face Pulls',
              sets: 4,
              reps: '25',
              weight: 'moderate',
              restSeconds: 45,
              instructions: 'Maximum rear delt activation'
            },
            {
              id: 'w6-d1-e7',
              name: 'Lateral Raise Complex',
              sets: 4,
              reps: 'See instructions',
              weight: 'varied',
              restSeconds: 120,
              instructions: '15 heavy lateral raises + 15 medium front raises + 15 light rear delt flyes'
            }
          ]
        }
        // Continue with remaining Week 6 workouts...
      ]
    }
  ]
};

// Update the main configuration
export const workoutConfig = {
  currentPlan: recoveryWorkoutPlan,
  plans: [recoveryWorkoutPlan]
};
