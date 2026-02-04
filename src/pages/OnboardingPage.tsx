import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import type { ProfileUpdateRequest, UserProfile } from '../types/workout';

// Onboarding data structure
interface OnboardingData {
  // Step 1: Demographics
  age?: number;
  gender?: string;
  heightCm?: number;
  weightKg?: number;

  // Step 2: Fitness Goals
  fitnessGoals: string[];

  // Step 3: Experience
  experienceLevel?: string;
  workoutFrequency?: number;
  workoutDuration?: number;

  // Step 4: Injuries
  injuries: string[];
  injuryDetails?: string;

  // Step 5: Equipment
  equipmentAvailable: string[];
  equipmentDetails?: string;

  // Step 6: Custom Goal
  customGoal?: string;

  // Step 7: Plan Duration
  planDurationWeeks: number;
}

const INITIAL_DATA: OnboardingData = {
  fitnessGoals: [],
  injuries: [],
  equipmentAvailable: [],
  planDurationWeeks: 8,
};

const STEPS = [
  { id: 'demographics', title: 'About You' },
  { id: 'goals', title: 'Your Goals' },
  { id: 'experience', title: 'Experience' },
  { id: 'injuries', title: 'Limitations' },
  { id: 'equipment', title: 'Equipment' },
  { id: 'custom', title: 'Your Goal' },
  { id: 'review', title: 'Review' },
  { id: 'generate', title: 'Generate Plan' },
];

export function OnboardingPage() {
  const api = useApi();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData>(INITIAL_DATA);
  const [error, setError] = useState<string | null>(null);

  // BYOC (Bring Your Own Claude) state
  const [prompt, setPrompt] = useState<string | null>(null);
  const [promptLoading, setPromptLoading] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);

  // Load existing profile data on mount
  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await api.get<UserProfile>('/profile');
        if (res.success && res.data) {
          const profile = res.data;
          setData(prev => ({
            ...prev,
            age: profile.age,
            gender: profile.gender,
            heightCm: profile.heightCm,
            weightKg: profile.weightKg,
            fitnessGoals: profile.fitnessGoals || [],
            experienceLevel: profile.experienceLevel,
            workoutFrequency: profile.workoutFrequency,
            workoutDuration: profile.workoutDuration,
            injuries: profile.injuries || [],
            injuryDetails: profile.injuryDetails,
            equipmentAvailable: profile.equipmentAvailable || [],
            equipmentDetails: profile.equipmentDetails,
            customGoal: profile.customGoal,
          }));
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        setProfileLoading(false);
      }
    }
    loadProfile();
  }, []);

  function updateData(updates: Partial<OnboardingData>) {
    setData(prev => ({ ...prev, ...updates }));
  }

  async function nextStep() {
    // If moving to generate step, save profile and fetch prompt
    if (step === 6) { // Review -> Generate
      const success = await saveProfileAndFetchPrompt();
      if (!success) return; // Don't advance if there was an error
    }
    // Use functional update to avoid stale state issues
    setStep(prev => prev < STEPS.length - 1 ? prev + 1 : prev);
  }

  function prevStep() {
    if (step > 0) {
      setStep(step - 1);
    }
  }

  async function saveProfileAndFetchPrompt(): Promise<boolean> {
    setPromptLoading(true);
    setError(null);

    try {
      // Save profile first
      const profileData: ProfileUpdateRequest = {
        age: data.age,
        gender: data.gender,
        heightCm: data.heightCm,
        weightKg: data.weightKg,
        experienceLevel: data.experienceLevel,
        workoutFrequency: data.workoutFrequency,
        workoutDuration: data.workoutDuration,
        fitnessGoals: data.fitnessGoals,
        injuries: data.injuries,
        injuryDetails: data.injuryDetails,
        equipmentAvailable: data.equipmentAvailable,
        equipmentDetails: data.equipmentDetails,
        customGoal: data.customGoal,
      };

      const profileRes = await api.put('/profile', profileData);
      if (!profileRes.success) {
        throw new Error(profileRes.error || 'Failed to save profile');
      }

      // Fetch the prompt
      const promptRes = await api.get<{ prompt: string; durationWeeks: number }>(`/plans/prompt?weeks=${data.planDurationWeeks}`);
      if (!promptRes.success || !promptRes.data) {
        throw new Error(promptRes.error || 'Failed to generate prompt');
      }

      setPrompt(promptRes.data.prompt);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      return false;
    } finally {
      setPromptLoading(false);
    }
  }

  async function importPlan() {
    setImporting(true);
    setError(null);
    setValidationErrors([]);

    try {
      // Parse JSON
      let planJson: unknown;
      try {
        planJson = JSON.parse(jsonInput);
      } catch {
        setValidationErrors(['Invalid JSON. Make sure you copied the complete response from your AI.']);
        setImporting(false);
        return;
      }

      // Send to API for validation and import
      const importRes = await api.post('/plans/import', {
        planJson,
        durationWeeks: data.planDurationWeeks,
      });

      if (!importRes.success) {
        if (importRes.validationErrors) {
          setValidationErrors(importRes.validationErrors);
        } else {
          setError(importRes.error || 'Failed to import plan');
        }
        setImporting(false);
        return;
      }

      // Success! Navigate to dashboard
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setImporting(false);
    }
  }

  async function copyPromptToClipboard() {
    if (prompt) {
      await navigator.clipboard.writeText(prompt);
    }
  }

  if (profileLoading) {
    return (
      <div className="onboarding-page generating">
        <div className="generating-content">
          <div className="spinner"></div>
          <h2>Loading...</h2>
        </div>
      </div>
    );
  }

  if (importing) {
    return (
      <div className="onboarding-page generating">
        <div className="generating-content">
          <div className="spinner"></div>
          <h2>Importing Your Plan</h2>
          <p>Validating and saving your workout plan...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="onboarding-page">
      <header className="onboarding-header">
        <h1>Flexer</h1>
        <div className="progress-dots">
          {STEPS.map((s, i) => (
            <span key={s.id} className={`dot ${i === step ? 'active' : ''} ${i < step ? 'completed' : ''}`} />
          ))}
        </div>
        <p className="step-title">{STEPS[step].title}</p>
      </header>

      <main className="onboarding-content">
        {error && <div className="error-banner">{error}</div>}

        {step === 0 && <DemographicsStep data={data} updateData={updateData} />}
        {step === 1 && <GoalsStep data={data} updateData={updateData} />}
        {step === 2 && <ExperienceStep data={data} updateData={updateData} />}
        {step === 3 && <InjuriesStep data={data} updateData={updateData} />}
        {step === 4 && <EquipmentStep data={data} updateData={updateData} />}
        {step === 5 && <CustomGoalStep data={data} updateData={updateData} />}
        {step === 6 && <ReviewStep data={data} updateData={updateData} />}
        {step === 7 && (
          <GeneratePlanStep
            prompt={prompt}
            promptLoading={promptLoading}
            jsonInput={jsonInput}
            setJsonInput={setJsonInput}
            validationErrors={validationErrors}
            onCopyPrompt={copyPromptToClipboard}
          />
        )}
      </main>

      <footer className="onboarding-footer">
        {step > 0 && (
          <button onClick={prevStep} className="btn btn-secondary">
            Back
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button onClick={nextStep} className="btn btn-primary">
            Continue
          </button>
        ) : (
          <button
            onClick={importPlan}
            className="btn btn-primary"
            disabled={!jsonInput.trim()}
          >
            Import Plan
          </button>
        )}
      </footer>
    </div>
  );
}

// ===== Step Components =====

interface StepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
}

function DemographicsStep({ data, updateData }: StepProps) {
  const [useImperial, setUseImperial] = useState(true); // Default to imperial for US users

  // Local state for imperial inputs to avoid round-trip conversion issues
  const [localFeet, setLocalFeet] = useState<string>('');
  const [localInches, setLocalInches] = useState<string>('');
  const [localLbs, setLocalLbs] = useState<string>('');

  // Initialize local imperial values from data on mount only
  useEffect(() => {
    if (data.heightCm) {
      const totalInches = data.heightCm / 2.54;
      setLocalFeet(String(Math.floor(totalInches / 12)));
      setLocalInches(String(Math.round(totalInches % 12)));
    }
    if (data.weightKg) {
      setLocalLbs(String(Math.round(data.weightKg * 2.205)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount - don't overwrite user input

  // Convert and save height when inputs change (on blur or after typing)
  function saveHeightImperial() {
    const feet = parseInt(localFeet) || 0;
    const inches = parseInt(localInches) || 0;
    if (feet === 0 && inches === 0) {
      updateData({ heightCm: undefined });
      return;
    }
    const totalInches = (feet * 12) + inches;
    const cm = Math.round(totalInches * 2.54);
    updateData({ heightCm: cm > 0 ? cm : undefined });
  }

  // Convert and save weight when input changes (on blur or after typing)
  function saveWeightImperial() {
    const lbs = parseInt(localLbs) || 0;
    if (lbs === 0) {
      updateData({ weightKg: undefined });
      return;
    }
    const kg = Math.round(lbs / 2.205);
    updateData({ weightKg: kg > 0 ? kg : undefined });
  }

  return (
    <div className="step-content">
      <div className="form-group">
        <label>Age</label>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={data.age || ''}
          onChange={e => {
            const val = e.target.value.replace(/\D/g, '');
            updateData({ age: val ? parseInt(val) : undefined });
          }}
          placeholder="30"
        />
      </div>

      <div className="form-group">
        <label>Gender</label>
        <div className="button-group">
          {['male', 'female', 'prefer_not_to_say'].map(g => (
            <button
              key={g}
              className={`btn-option ${data.gender === g ? 'selected' : ''}`}
              onClick={() => updateData({ gender: g })}
            >
              {g === 'prefer_not_to_say' ? 'Prefer not to say' : g.charAt(0).toUpperCase() + g.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="unit-toggle">
        <button
          className={`btn-toggle ${useImperial ? 'active' : ''}`}
          onClick={() => setUseImperial(true)}
        >
          Imperial (ft/lbs)
        </button>
        <button
          className={`btn-toggle ${!useImperial ? 'active' : ''}`}
          onClick={() => setUseImperial(false)}
        >
          Metric (cm/kg)
        </button>
      </div>

      {useImperial ? (
        <>
          <div className="form-group">
            <label>Height</label>
            <div className="height-imperial">
              <div className="height-field">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={localFeet}
                  onChange={e => setLocalFeet(e.target.value.replace(/\D/g, ''))}
                  onBlur={saveHeightImperial}
                  placeholder="5"
                />
                <span className="unit-label">ft</span>
              </div>
              <div className="height-field">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={localInches}
                  onChange={e => setLocalInches(e.target.value.replace(/\D/g, ''))}
                  onBlur={saveHeightImperial}
                  placeholder="10"
                />
                <span className="unit-label">in</span>
              </div>
            </div>
          </div>
          <div className="form-group">
            <label>Weight (lbs)</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={localLbs}
              onChange={e => setLocalLbs(e.target.value.replace(/\D/g, ''))}
              onBlur={saveWeightImperial}
              placeholder="160"
            />
          </div>
        </>
      ) : (
        <div className="form-row">
          <div className="form-group">
            <label>Height (cm)</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={data.heightCm || ''}
              onChange={e => {
                const val = e.target.value.replace(/\D/g, '');
                updateData({ heightCm: val ? parseInt(val) : undefined });
              }}
              placeholder="175"
            />
          </div>
          <div className="form-group">
            <label>Weight (kg)</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={data.weightKg || ''}
              onChange={e => {
                const val = e.target.value.replace(/\D/g, '');
                updateData({ weightKg: val ? parseInt(val) : undefined });
              }}
              placeholder="70"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function GoalsStep({ data, updateData }: StepProps) {
  const goals = [
    { id: 'build_muscle', label: 'Build Muscle' },
    { id: 'lose_weight', label: 'Lose Weight' },
    { id: 'improve_strength', label: 'Get Stronger' },
    { id: 'increase_endurance', label: 'Build Endurance' },
    { id: 'general_fitness', label: 'General Fitness' },
    { id: 'recovery', label: 'Rehab / Recovery' },
    { id: 'flexibility', label: 'Flexibility' },
    { id: 'sport_specific', label: 'Sport Training' },
  ];

  function toggleGoal(id: string) {
    const current = data.fitnessGoals;
    if (current.includes(id)) {
      updateData({ fitnessGoals: current.filter(g => g !== id) });
    } else {
      updateData({ fitnessGoals: [...current, id] });
    }
  }

  return (
    <div className="step-content">
      <p className="step-instruction">Select all that apply:</p>
      <div className="checkbox-grid">
        {goals.map(goal => (
          <button
            key={goal.id}
            className={`btn-checkbox ${data.fitnessGoals.includes(goal.id) ? 'selected' : ''}`}
            onClick={() => toggleGoal(goal.id)}
          >
            {goal.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ExperienceStep({ data, updateData }: StepProps) {
  return (
    <div className="step-content">
      <div className="form-group">
        <label>Experience Level</label>
        <div className="button-group vertical">
          {[
            { id: 'beginner', label: 'Beginner', desc: 'New to working out (0-1 years)' },
            { id: 'intermediate', label: 'Intermediate', desc: 'Regular training (1-3 years)' },
            { id: 'advanced', label: 'Advanced', desc: 'Experienced lifter (3+ years)' },
          ].map(level => (
            <button
              key={level.id}
              className={`btn-option-large ${data.experienceLevel === level.id ? 'selected' : ''}`}
              onClick={() => updateData({ experienceLevel: level.id })}
            >
              <strong>{level.label}</strong>
              <span>{level.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label>Days per week you can train</label>
        <div className="slider-group">
          <input
            type="range"
            min="2"
            max="6"
            value={data.workoutFrequency || 4}
            onChange={e => updateData({ workoutFrequency: parseInt(e.target.value) })}
          />
          <span className="slider-value">{data.workoutFrequency || 4} days</span>
        </div>
      </div>

      <div className="form-group">
        <label>Minutes per workout session</label>
        <div className="slider-group">
          <input
            type="range"
            min="20"
            max="90"
            step="5"
            value={data.workoutDuration || 45}
            onChange={e => updateData({ workoutDuration: parseInt(e.target.value) })}
          />
          <span className="slider-value">{data.workoutDuration || 45} min</span>
        </div>
      </div>
    </div>
  );
}

function InjuriesStep({ data, updateData }: StepProps) {
  const bodyParts = [
    { id: 'shoulder', label: 'Shoulder' },
    { id: 'knee', label: 'Knee' },
    { id: 'lower_back', label: 'Lower Back' },
    { id: 'hip', label: 'Hip' },
    { id: 'ankle', label: 'Ankle' },
    { id: 'wrist', label: 'Wrist' },
    { id: 'elbow', label: 'Elbow' },
    { id: 'neck', label: 'Neck' },
  ];

  function toggleInjury(id: string) {
    const current = data.injuries;
    if (current.includes(id)) {
      updateData({ injuries: current.filter(i => i !== id) });
    } else {
      updateData({ injuries: [...current, id] });
    }
  }

  return (
    <div className="step-content">
      <p className="step-instruction">Any injuries or areas to avoid? (Select all that apply)</p>
      <div className="checkbox-grid">
        {bodyParts.map(part => (
          <button
            key={part.id}
            className={`btn-checkbox ${data.injuries.includes(part.id) ? 'selected' : ''}`}
            onClick={() => toggleInjury(part.id)}
          >
            {part.label}
          </button>
        ))}
      </div>

      {data.injuries.length > 0 && (
        <div className="form-group">
          <label>Tell us more about your injury (optional)</label>
          <textarea
            value={data.injuryDetails || ''}
            onChange={e => updateData({ injuryDetails: e.target.value })}
            placeholder="e.g., Recovering from rotator cuff surgery 3 months ago, cleared for light exercise..."
            rows={3}
          />
        </div>
      )}
    </div>
  );
}

function EquipmentStep({ data, updateData }: StepProps) {
  const equipment = [
    { id: 'dumbbells', label: 'Dumbbells' },
    { id: 'barbell', label: 'Barbell' },
    { id: 'kettlebell', label: 'Kettlebell' },
    { id: 'pull_up_bar', label: 'Pull-up Bar' },
    { id: 'bench', label: 'Bench' },
    { id: 'cables', label: 'Cable Machine' },
    { id: 'resistance_bands', label: 'Resistance Bands' },
    { id: 'cardio_machines', label: 'Cardio Machines' },
    { id: 'full_gym', label: 'Full Gym Access' },
  ];

  function toggleEquipment(id: string) {
    const current = data.equipmentAvailable;
    if (current.includes(id)) {
      updateData({ equipmentAvailable: current.filter(e => e !== id) });
    } else {
      updateData({ equipmentAvailable: [...current, id] });
    }
  }

  return (
    <div className="step-content">
      <p className="step-instruction">What equipment do you have access to?</p>
      <p className="step-note">No equipment? No problem! Leave empty for a bodyweight-only plan.</p>
      <div className="checkbox-grid">
        {equipment.map(eq => (
          <button
            key={eq.id}
            className={`btn-checkbox ${data.equipmentAvailable.includes(eq.id) ? 'selected' : ''}`}
            onClick={() => toggleEquipment(eq.id)}
          >
            {eq.label}
          </button>
        ))}
      </div>

      <div className="form-group">
        <label>Additional equipment details (optional)</label>
        <textarea
          value={data.equipmentDetails || ''}
          onChange={e => updateData({ equipmentDetails: e.target.value })}
          placeholder="e.g., Home gym with adjustable dumbbells 5-50lbs, Olympic barbell..."
          rows={2}
        />
      </div>
    </div>
  );
}

function CustomGoalStep({ data, updateData }: StepProps) {
  return (
    <div className="step-content">
      <p className="step-instruction">
        Describe your goal in your own words. Be specific about what you want to achieve.
      </p>
      <div className="form-group">
        <textarea
          value={data.customGoal || ''}
          onChange={e => updateData({ customGoal: e.target.value })}
          placeholder="e.g., I'm recovering from a shoulder injury and want to rebuild strength safely. I also want to improve my overall fitness and lose some weight around my midsection."
          rows={5}
          className="large-textarea"
        />
      </div>
      <div className="examples">
        <p className="examples-title">Examples:</p>
        <ul>
          <li>"Training for a marathon in June, need to build leg strength"</li>
          <li>"Want visible abs while maintaining muscle mass"</li>
          <li>"Rehabbing rotator cuff, focus on shoulder stability"</li>
          <li>"Build overall strength, especially upper body"</li>
        </ul>
      </div>
    </div>
  );
}

function ReviewStep({ data, updateData }: StepProps) {
  return (
    <div className="step-content">
      <h3>Review Your Plan</h3>

      <div className="review-section">
        <h4>Profile</h4>
        <p>
          {data.age ? `${data.age} years old` : 'Age not specified'}
          {data.gender && data.gender !== 'prefer_not_to_say' && `, ${data.gender}`}
        </p>
        <p>{data.experienceLevel || 'Experience not specified'} level</p>
        <p>
          {data.workoutFrequency || 4} days/week, {data.workoutDuration || 45} min sessions
        </p>
      </div>

      <div className="review-section">
        <h4>Goals</h4>
        <p>{data.fitnessGoals.length > 0 ? data.fitnessGoals.join(', ').replace(/_/g, ' ') : 'None selected'}</p>
      </div>

      {data.injuries.length > 0 && (
        <div className="review-section">
          <h4>Injuries</h4>
          <p>{data.injuries.join(', ').replace(/_/g, ' ')}</p>
          {data.injuryDetails && <p className="detail">{data.injuryDetails}</p>}
        </div>
      )}

      <div className="review-section">
        <h4>Equipment</h4>
        <p>
          {data.equipmentAvailable.length > 0
            ? data.equipmentAvailable.join(', ').replace(/_/g, ' ')
            : 'None selected'}
        </p>
      </div>

      {data.customGoal && (
        <div className="review-section">
          <h4>Your Goal</h4>
          <p className="detail">"{data.customGoal}"</p>
        </div>
      )}

      <div className="form-group">
        <label>Plan Duration</label>
        <div className="button-group">
          {[6, 8, 12].map(weeks => (
            <button
              key={weeks}
              className={`btn-option ${data.planDurationWeeks === weeks ? 'selected' : ''}`}
              onClick={() => updateData({ planDurationWeeks: weeks })}
            >
              {weeks} weeks
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

interface GeneratePlanStepProps {
  prompt: string | null;
  promptLoading: boolean;
  jsonInput: string;
  setJsonInput: (value: string) => void;
  validationErrors: string[];
  onCopyPrompt: () => void;
}

function GeneratePlanStep({
  prompt,
  promptLoading,
  jsonInput,
  setJsonInput,
  validationErrors,
  onCopyPrompt,
}: GeneratePlanStepProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await onCopyPrompt();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (promptLoading) {
    return (
      <div className="step-content">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Generating your personalized prompt...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="step-content generate-step">
      <div className="byoc-instructions">
        <h3>Generate Your Workout Plan</h3>
        <p>Follow these 3 simple steps to create your personalized plan:</p>
        <p className="free-tier-note">Works with any AI assistant - no subscription required!</p>

        <div className="instruction-steps">
          <div className="instruction-step">
            <span className="step-number">1</span>
            <div>
              <strong>Copy the prompt below</strong>
              <p>Click the button to copy your personalized workout prompt</p>
            </div>
          </div>

          <div className="instruction-step">
            <span className="step-number">2</span>
            <div>
              <strong>Paste into your favorite AI</strong>
              <p>
                Use{' '}
                <a href="https://claude.ai" target="_blank" rel="noopener noreferrer">
                  Claude
                </a>
                ,{' '}
                <a href="https://chat.openai.com" target="_blank" rel="noopener noreferrer">
                  ChatGPT
                </a>
                , or{' '}
                <a href="https://gemini.google.com" target="_blank" rel="noopener noreferrer">
                  Gemini
                </a>
              </p>
              <p className="warning-text">
                Wait for it to finish (2-3 minutes). The response is large!
              </p>
            </div>
          </div>

          <div className="instruction-step">
            <span className="step-number">3</span>
            <div>
              <strong>Paste the JSON response</strong>
              <p>Copy the entire response and paste it below</p>
            </div>
          </div>
        </div>
      </div>

      <div className="prompt-section">
        <div className="prompt-header">
          <label>Your Personalized Prompt</label>
          <button onClick={handleCopy} className="btn btn-small" disabled={!prompt}>
            {copied ? 'Copied!' : 'Copy Prompt'}
          </button>
        </div>
        {prompt ? (
          <pre className="prompt-preview">{prompt}</pre>
        ) : (
          <div className="prompt-error">
            Failed to load prompt. Please go back and try again, or check that you're logged in.
          </div>
        )}
      </div>

      <div className="json-section">
        <label>Paste Your AI's Response (JSON)</label>
        <p className="json-section-note">
          It can take 2-3 minutes to generate your plan. Make sure your AI has finished typing before copying!
        </p>
        <textarea
          value={jsonInput}
          onChange={e => setJsonInput(e.target.value)}
          placeholder='Paste the JSON response here...

It should start with something like:
{
  "id": "plan-generated",
  "name": "Your Workout Plan",
  ...'
          rows={10}
          className="json-input"
        />

        {validationErrors.length > 0 && (
          <div className="validation-errors">
            <strong>Validation Errors:</strong>
            <ul>
              {validationErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
