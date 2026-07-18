/**
 * Medications: add, list, mark taken, and see interactions.
 *
 * Interactions are shown as prompts to raise with a doctor. Nothing here tells
 * the user to start, stop, or change a dose -- that boundary is enforced in the
 * backend's system prompts and it must hold in the interface too, or the rule
 * only exists where nobody can see it.
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Pill, Plus, X } from 'lucide-react';
import { del, get, patch, post } from '../lib/api';
import type { Interaction, Medication } from '../lib/types';

export default function MedicationsPage() {
  const [meds, setMeds] = useState<Medication[]>([]);
  const [conflicts, setConflicts] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [schedule, setSchedule] = useState('');
  const [adding, setAdding] = useState(false);

  const load = async () => {
    try {
      const [list, found] = await Promise.all([
        get<Medication[]>('/api/medications'),
        get<Interaction[]>('/api/medications/interactions'),
      ]);
      setMeds(list);
      setConflicts(found);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load medications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setAdding(true);
    setError('');
    try {
      await post('/api/medications', {
        drug_name: name.trim(),
        dose: dose.trim() || null,
        schedule: schedule.trim() || null,
      });
      setName('');
      setDose('');
      setSchedule('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add this medication');
    } finally {
      setAdding(false);
    }
  };

  const toggle = async (m: Medication) => {
    // Optimistic: the tick should feel instant. A failure reloads the truth.
    setMeds((prev) =>
      prev.map((x) => (x.id === m.id ? { ...x, taken_today: !x.taken_today } : x)),
    );
    try {
      await patch(`/api/medications/${m.id}/taken`, { taken: !m.taken_today });
    } catch {
      await load();
    }
  };

  const remove = async (m: Medication) => {
    await del(`/api/medications/${m.id}`);
    await load();
  };

  return (
    <main className="page">
      <header className="page-head">
        <div>
          <h1>Medications</h1>
          <p>Track what you take and see interactions worth raising with your doctor.</p>
        </div>
      </header>

      {conflicts.length > 0 && (
        <section className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
          <span className="card-label">
            <AlertTriangle size={14} /> INTERACTIONS FOUND
          </span>
          <div className="reasons">
            {conflicts.map((c, i) => (
              <div className="risk-row" key={i}>
                <div>
                  <b>{c.drugs.join(' + ')}</b>
                  <span>{c.description}</span>
                </div>
                <strong className={c.severity === 'major' ? 'high' : 'medium'}>
                  {c.severity}
                </strong>
              </div>
            ))}
          </div>
          <small style={{ display: 'block', marginTop: '0.75rem', opacity: 0.75 }}>
            Bring this to your doctor or pharmacist. Do not stop or change any medication
            on your own.
          </small>
        </section>
      )}

      <form className="card" style={{ padding: '1.5rem', maxWidth: 720 }} onSubmit={add}>
        <span className="card-label">ADD A MEDICATION</span>
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Ecosprin 75mg" required />
          </label>
          <label>
            Dose
            <input value={dose} onChange={(e) => setDose(e.target.value)} placeholder="75mg" />
          </label>
          <label>
            Schedule
            <input value={schedule} onChange={(e) => setSchedule(e.target.value)}
              placeholder="After breakfast" />
          </label>
        </div>
        <small style={{ display: 'block', marginTop: '0.5rem', opacity: 0.7 }}>
          Brand names work — AURA maps them to their generic ingredient before checking
          interactions.
        </small>
        <button className="btn primary" style={{ marginTop: '1rem' }} disabled={adding}>
          <Plus size={16} /> {adding ? 'Adding…' : 'Add medication'}
        </button>
      </form>

      {error && <div className="error" style={{ marginTop: '1rem' }}>{error}</div>}

      <section style={{ marginTop: '2rem', maxWidth: 720 }}>
        <span className="card-label">CURRENT MEDICATIONS</span>
        {loading ? (
          <p style={{ opacity: 0.7 }}>Loading…</p>
        ) : meds.length === 0 ? (
          <p style={{ opacity: 0.7 }}>
            Nothing added yet. Add your prescriptions to check for interactions.
          </p>
        ) : (
          meds.map((m) => (
            <div className="med-row" key={m.id}>
              <button type="button" onClick={() => toggle(m)}
                className={m.taken_today ? 'check on' : 'check'}
                aria-label={m.taken_today ? 'Mark as not taken' : 'Mark as taken today'}>
                {m.taken_today && <Check />}
              </button>
              <div>
                <b>
                  <Pill size={14} /> {m.drug_name}
                  {m.dose ? ` · ${m.dose}` : ''}
                </b>
                <span>{m.schedule || 'As prescribed'}</span>
              </div>
              <small>{m.taken_today ? 'Taken today' : 'Due'}</small>
              <button type="button" className="btn ghost" onClick={() => remove(m)}
                aria-label={`Remove ${m.drug_name}`}>
                <X size={15} />
              </button>
            </div>
          ))
        )}
      </section>
    </main>
  );
}
