/**
 * Daily lifestyle log.
 *
 * Feeds the sleep, activity and hydration components of the Health Score. Until
 * this existed those three could never be assessed, so the dashboard showed
 * coverage gaps that the user had no way to close.
 *
 * Every field is optional and empty means "not logged" -- never zero. The
 * backend excludes missing metrics from its averages rather than treating them
 * as a bad day, so a blank field must stay blank all the way down.
 */

import { useEffect, useState } from 'react';
import { Check, Droplets, Footprints, Moon } from 'lucide-react';
import { get, put } from '../lib/api';
import type { DailyLog } from '../lib/types';

const today = () => new Date().toISOString().slice(0, 10);

/** '' -> null so an untouched field is not submitted as a real zero. */
const numeric = (value: string) => (value.trim() === '' ? null : Number(value));

export default function LogDayPage() {
  const [date, setDate] = useState(today());
  const [steps, setSteps] = useState('');
  const [sleep, setSleep] = useState('');
  const [water, setWater] = useState('');

  const [recent, setRecent] = useState<DailyLog[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const load = () =>
    get<DailyLog[]>('/api/logs?days=7')
      .then(setRecent)
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  // Editing an existing day should show what is already recorded, not a blank
  // form that silently overwrites it.
  useEffect(() => {
    const existing = recent.find((l) => l.date === date);
    setSteps(existing?.steps != null ? String(existing.steps) : '');
    setSleep(existing?.sleep_hours != null ? String(existing.sleep_hours) : '');
    setWater(existing?.water_ml != null ? String(existing.water_ml) : '');
  }, [date, recent]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await put(`/api/logs/${date}`, {
        steps: numeric(steps),
        sleep_hours: numeric(sleep),
        water_ml: numeric(water),
      });
      await load();
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this day');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="page">
      <header className="page-head">
        <div>
          <h1>Log your day</h1>
          <p>Sleep, activity and hydration feed directly into your Health Score.</p>
        </div>
      </header>

      <form className="card" style={{ padding: '1.75rem', maxWidth: 640 }} onSubmit={submit}>
        <label>
          Date
          <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
        </label>

        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', marginTop: '1rem' }}>
          <label>
            <Footprints size={15} /> Steps
            <input type="number" min={0} max={100000} value={steps}
              onChange={(e) => setSteps(e.target.value)} placeholder="8000" />
          </label>

          <label>
            <Moon size={15} /> Sleep (hours)
            <input type="number" min={0} max={24} step="0.1" value={sleep}
              onChange={(e) => setSleep(e.target.value)} placeholder="7.5" />
          </label>

          <label>
            <Droplets size={15} /> Water (ml)
            <input type="number" min={0} max={20000} step={50} value={water}
              onChange={(e) => setWater(e.target.value)} placeholder="2500" />
          </label>
        </div>

        <small style={{ display: 'block', marginTop: '0.75rem', opacity: 0.7 }}>
          Leave a field empty if you did not track it. Empty is not counted as zero —
          AURA will not penalise you for something you simply did not log.
        </small>

        {error && <div className="error" style={{ marginTop: '1rem' }}>{error}</div>}

        <button className="btn primary" style={{ marginTop: '1.25rem' }} disabled={saving}>
          {saved ? (<><Check size={17} /> Saved</>) : saving ? 'Saving…' : 'Save this day'}
        </button>
      </form>

      <section style={{ marginTop: '2rem', maxWidth: 640 }}>
        <span className="card-label">LAST 7 DAYS</span>
        {recent.length === 0 ? (
          <p style={{ opacity: 0.7 }}>Nothing logged yet.</p>
        ) : (
          <div className="reasons">
            {recent.map((l) => (
              <div className="risk-row" key={l.date}>
                <div>
                  <b>{l.date}</b>
                  <span>
                    {[
                      l.steps != null && `${l.steps.toLocaleString()} steps`,
                      l.sleep_hours != null && `${l.sleep_hours} h sleep`,
                      l.water_ml != null && `${l.water_ml} ml water`,
                    ].filter(Boolean).join(' · ') || 'nothing recorded'}
                  </span>
                </div>
                <button className="btn ghost" type="button" onClick={() => setDate(l.date)}>
                  Edit
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
