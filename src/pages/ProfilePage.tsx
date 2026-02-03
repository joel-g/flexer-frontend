import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClerk } from '@clerk/clerk-react';
import { useApi } from '../hooks/useApi';
import type { UserProfile, ProfileUpdateRequest } from '../types/workout';

const EQUIPMENT_OPTIONS = [
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

export function ProfilePage() {
  const api = useApi();
  const navigate = useNavigate();
  const { signOut } = useClerk();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [useImperial, setUseImperial] = useState(true);

  // Form state (metric values stored)
  const [age, setAge] = useState<number | undefined>();
  const [heightCm, setHeightCm] = useState<number | undefined>();
  const [weightKg, setWeightKg] = useState<number | undefined>();
  const [equipment, setEquipment] = useState<string[]>([]);

  // Imperial display state (to avoid round-trip conversion issues)
  const [localFeet, setLocalFeet] = useState('');
  const [localInches, setLocalInches] = useState('');
  const [localLbs, setLocalLbs] = useState('');

  // Load profile on mount
  useEffect(() => {
    loadProfile();
  }, []);

  // Auto-save imperial height when local values change
  useEffect(() => {
    if (!useImperial) return;
    const feet = parseInt(localFeet) || 0;
    const inches = parseInt(localInches) || 0;
    if (feet > 0 || inches > 0) {
      const totalInches = (feet * 12) + inches;
      const cm = Math.round(totalInches * 2.54);
      if (cm !== heightCm) {
        setHeightCm(cm);
      }
    }
  }, [localFeet, localInches, useImperial]);

  // Auto-save imperial weight when local value changes
  useEffect(() => {
    if (!useImperial) return;
    const lbs = parseInt(localLbs) || 0;
    if (lbs > 0) {
      const kg = Math.round(lbs / 2.205);
      if (kg !== weightKg) {
        setWeightKg(kg);
      }
    }
  }, [localLbs, useImperial]);

  async function loadProfile() {
    try {
      setLoading(true);
      const res = await api.get<UserProfile>('/profile');

      if (res.success && res.data) {
        setAge(res.data.age);
        setHeightCm(res.data.heightCm);
        setWeightKg(res.data.weightKg);
        setEquipment(res.data.equipmentAvailable || []);

        // Initialize imperial display values
        if (res.data.heightCm) {
          const totalInches = res.data.heightCm / 2.54;
          setLocalFeet(String(Math.floor(totalInches / 12)));
          setLocalInches(String(Math.round(totalInches % 12)));
        }
        if (res.data.weightKg) {
          setLocalLbs(String(Math.round(res.data.weightKg * 2.205)));
        }
      }
    } catch (err) {
      setError('Failed to load profile');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function saveProfile() {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const profileData: ProfileUpdateRequest = {
        age,
        heightCm,
        weightKg,
        equipmentAvailable: equipment,
      };

      const res = await api.put('/profile', profileData);
      if (!res.success) {
        throw new Error(res.error || 'Failed to save profile');
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  }

  function toggleEquipment(id: string) {
    if (equipment.includes(id)) {
      setEquipment(equipment.filter(e => e !== id));
    } else {
      setEquipment([...equipment, id]);
    }
  }

  async function handleSignOut() {
    await signOut();
    navigate('/sign-in');
  }

  if (loading) {
    return (
      <div className="profile-page">
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <header className="profile-header">
        <button onClick={() => navigate('/dashboard')} className="back-btn">
          &larr; Back
        </button>
        <h1>Profile Settings</h1>
      </header>

      <main className="profile-content">
        {error && <div className="error-banner">{error}</div>}
        {success && <div className="success-banner">Profile saved successfully!</div>}

        <section className="profile-section">
          <h2>Personal Info</h2>

          <div className="form-group">
            <label>Age</label>
            <input
              type="number"
              value={age || ''}
              onChange={e => setAge(parseInt(e.target.value) || undefined)}
              placeholder="30"
              min="13"
              max="100"
            />
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
                      type="number"
                      value={localFeet}
                      onChange={e => setLocalFeet(e.target.value)}
                      placeholder="5"
                      min="3"
                      max="8"
                    />
                    <span className="unit-label">ft</span>
                  </div>
                  <div className="height-field">
                    <input
                      type="number"
                      value={localInches}
                      onChange={e => setLocalInches(e.target.value)}
                      placeholder="10"
                      min="0"
                      max="11"
                    />
                    <span className="unit-label">in</span>
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label>Weight (lbs)</label>
                <input
                  type="number"
                  value={localLbs}
                  onChange={e => setLocalLbs(e.target.value)}
                  placeholder="160"
                  min="50"
                  max="500"
                />
              </div>
            </>
          ) : (
            <div className="form-row">
              <div className="form-group">
                <label>Height (cm)</label>
                <input
                  type="number"
                  value={heightCm || ''}
                  onChange={e => setHeightCm(parseInt(e.target.value) || undefined)}
                  placeholder="175"
                />
              </div>
              <div className="form-group">
                <label>Weight (kg)</label>
                <input
                  type="number"
                  value={weightKg || ''}
                  onChange={e => setWeightKg(parseInt(e.target.value) || undefined)}
                  placeholder="70"
                />
              </div>
            </div>
          )}
        </section>

        <section className="profile-section">
          <h2>Equipment</h2>
          <p className="section-description">What equipment do you have access to?</p>
          <p className="section-note">No equipment? No problem! Leave empty for a bodyweight-only plan.</p>
          <div className="checkbox-grid">
            {EQUIPMENT_OPTIONS.map(eq => (
              <button
                key={eq.id}
                className={`btn-checkbox ${equipment.includes(eq.id) ? 'selected' : ''}`}
                onClick={() => toggleEquipment(eq.id)}
              >
                {eq.label}
              </button>
            ))}
          </div>
        </section>

        <div className="profile-actions">
          <button
            onClick={saveProfile}
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        <p className="profile-note">
          Changes will be used when generating your next workout plan.
        </p>

        <section className="profile-section account-section">
          <h2>Account</h2>
          <button onClick={handleSignOut} className="btn btn-secondary">
            Sign Out
          </button>
        </section>
      </main>
    </div>
  );
}
