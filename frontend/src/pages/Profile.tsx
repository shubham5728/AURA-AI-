/**
 * Profile / onboarding.
 *
 * The most important screen in the app despite being the plainest. The Digital
 * Twin's initial state is this form -- with no profile the backend cannot score,
 * cannot compute BMI, and every AI answer falls back to generic advice, which is
 * the exact failure the product exists to fix.
 *
 * Kept to eight fields. Long onboarding costs completion, and during a live demo
 * it costs stage time.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { ApiError, get, put } from '../lib/api';
import type { Profile } from '../lib/types';

const SEXES = ['male', 'female', 'other'];

/** Comma-separated text <-> string[], so users are not made to manage a list widget. */
const toList = (value: string) =>
  value.split(',').map((s) => s.trim()).filter(Boolean);

export default function ProfilePage() {
  const nav = useNavigate();

  const [dob, setDob] = useState('');
  const [sex, setSex] = useState('male');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [conditions, setConditions] = useState('');
  const [allergies, setAllergies] = useState('');
  const [goals, setGoals] = useState('');

  const [existing, setExisting] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    get<Profile>('/api/profile')
      .then((p) => {
        setExisting(p);
        setDob(p.dob);
        setSex(p.sex);
        setHeight(String(p.height_cm));
        setWeight(String(p.weight_kg));
        setConditions(p.conditions.join(', '));
        setAllergies(p.allergies.join(', '));
        setGoals(p.goals.join(', '));
      })
      // 404 means "not onboarded yet", which is the normal first visit, not an
      // error worth showing.
      .catch((e) => {
        if (!(e instanceof ApiError) || e.status !== 404) {
          setError(e.message);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const saved = await put<Profile>('/api/profile', {
        dob,
        sex,
        height_cm: Number(height),
        weight_kg: Number(weight),
        conditions: toList(conditions),
        allergies: toList(allergies),
        goals: toList(goals),
      });
      setExisting(saved);
      setSaved(true);
      // Straight to the dashboard on first completion -- the point of onboarding
      // is to see the Twin, not to admire the form.
      setTimeout(() => nav('/app'), 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="center">
        <div className="spinner" />
        Loading your profile…
      </div>
    );
  }

  return (
    <main className="page">
      <header className="page-head">
        <div>
          <h1>{existing ? 'Your profile' : 'Build your Digital Twin'}</h1>
          <p>
            {existing
              ? 'These details shape every score and every answer AURA gives you.'
              : 'AURA needs a baseline before it can personalise anything. This takes a minute.'}
          </p>
        </div>
      </header>

      <form className="card" style={{ padding: '1.75rem', maxWidth: 720 }} onSubmit={submit}>
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
          <label>
            Date of birth
            <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} required />
          </label>

          <label>
            Sex
            <select value={sex} onChange={(e) => setSex(e.target.value)}>
              {SEXES.map((s) => (
                <option key={s} value={s}>
                  {s[0].toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Height (cm)
            <input
              type="number" min={50} max={260} step="0.1" value={height}
              onChange={(e) => setHeight(e.target.value)} required
            />
          </label>

          <label>
            Weight (kg)
            <input
              type="number" min={10} max={400} step="0.1" value={weight}
              onChange={(e) => setWeight(e.target.value)} required
            />
          </label>
        </div>

        <label style={{ marginTop: '1rem', display: 'block' }}>
          Existing conditions
          <input
            value={conditions} onChange={(e) => setConditions(e.target.value)}
            placeholder="prediabetes, hypertension"
          />
          <small>Separate with commas. Leave empty if none.</small>
        </label>

        <label style={{ marginTop: '1rem', display: 'block' }}>
          Allergies
          <input
            value={allergies} onChange={(e) => setAllergies(e.target.value)}
            placeholder="peanuts, penicillin"
          />
          <small>AURA will never suggest a food or drug you list here.</small>
        </label>

        <label style={{ marginTop: '1rem', display: 'block' }}>
          Health goals
          <input
            value={goals} onChange={(e) => setGoals(e.target.value)}
            placeholder="lower HbA1c, sleep 8 hours"
          />
        </label>

        {existing?.bmi != null && (
          <p style={{ marginTop: '1rem', opacity: 0.75 }}>
            Current BMI <b>{existing.bmi}</b> · Age <b>{existing.age}</b>
            <br />
            <small>Calculated by the server so every part of AURA uses the same numbers.</small>
          </p>
        )}

        {error && <div className="error" style={{ marginTop: '1rem' }}>{error}</div>}

        <button className="btn primary" style={{ marginTop: '1.5rem' }} disabled={saving}>
          {saved ? (<><Check size={17} /> Saved</>) : saving ? 'Saving…' : (
            <>{existing ? 'Save changes' : 'Create my Digital Twin'} <ArrowRight size={17} /></>
          )}
        </button>
      </form>
    </main>
  );
}
