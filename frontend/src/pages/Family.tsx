/**
 * Household health records.
 *
 * Not family accounts. Sharing health data between people needs a consent
 * model, and consent done badly with medical records causes real harm -- so
 * this is the user's own notebook about their relatives, which is a smaller
 * thing that can be built correctly.
 *
 * It is also the input for hereditary risk: "father, diabetes" is what makes a
 * raised HbA1c worth a second look.
 */

import { useEffect, useState } from 'react';
import { Plus, Users, X } from 'lucide-react';
import { del, get, post } from '../lib/api';

interface Member {
  id: number;
  name: string;
  relation: string;
  birth_year: number | null;
  conditions: string[];
  notes: string | null;
}

interface Trackable {
  key: string;
  label: string;
  tracked_by: string[];
}

const RELATIONS = [
  'mother', 'father', 'brother', 'sister', 'son', 'daughter',
  'grandmother', 'grandfather', 'aunt', 'uncle', 'cousin',
];

export default function FamilyPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [trackable, setTrackable] = useState<Trackable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [relation, setRelation] = useState('mother');
  const [year, setYear] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [list, conditions] = await Promise.all([
        get<Member[]>('/api/family'),
        get<Trackable[]>('/api/family/trackable-conditions'),
      ]);
      setMembers(list);
      setTrackable(conditions);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your family records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = (label: string) =>
    setPicked((prev) =>
      prev.includes(label) ? prev.filter((c) => c !== label) : [...prev, label],
    );

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    try {
      await post('/api/family', {
        name: name.trim(),
        relation,
        birth_year: year ? Number(year) : null,
        conditions: picked,
      });
      setName('');
      setYear('');
      setPicked([]);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this record');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (m: Member) => {
    await del(`/api/family/${m.id}`);
    await load();
  };

  return (
    <main className="page" style={{ maxWidth: 1020 }}>
      <header className="page-head">
        <div>
          <h1>Family health</h1>
          <p>
            Record your relatives' conditions. AURA uses this to show which of your own
            results are worth watching more closely.
          </p>
        </div>
      </header>

      <form className="card" style={{ padding: '1.5rem' }} onSubmit={add}>
        <span className="card-label">ADD A FAMILY MEMBER</span>

        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Ramesh" required />
          </label>
          <label>
            Relation
            <select value={relation} onChange={(e) => setRelation(e.target.value)}>
              {RELATIONS.map((r) => (
                <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</option>
              ))}
            </select>
          </label>
          <label>
            Birth year
            <input type="number" min={1900} max={new Date().getFullYear()}
              value={year} onChange={(e) => setYear(e.target.value)} placeholder="1962" />
          </label>
        </div>

        <div style={{ marginTop: '0.5rem' }}>
          <label style={{ marginBottom: 8 }}>Known conditions</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {/* Only conditions AURA can connect to a result. Offering ones it
                cannot track would collect data that produces nothing. */}
            {trackable.map((c) => (
              <button key={c.key} type="button" onClick={() => toggle(c.label)}
                className={picked.includes(c.label) ? 'btn primary' : 'btn ghost'}
                style={{ padding: '6px 12px', fontSize: 13 }}>
                {c.label}
              </button>
            ))}
          </div>
          <small style={{ display: 'block', marginTop: '0.6rem', opacity: 0.7 }}>
            These are the conditions AURA can link to your own lab results.
          </small>
        </div>

        {error && <div className="error" style={{ marginTop: '1rem' }}>{error}</div>}

        <button className="btn primary" style={{ marginTop: '1.25rem' }} disabled={saving}>
          <Plus size={16} /> {saving ? 'Saving…' : 'Add family member'}
        </button>
      </form>

      <section style={{ marginTop: '2rem' }}>
        <span className="card-label">YOUR FAMILY</span>
        {loading ? (
          <p style={{ opacity: 0.7 }}>Loading…</p>
        ) : members.length === 0 ? (
          <article className="card" style={{ padding: '2rem', textAlign: 'center' }}>
            <div className="upload-icon"><Users /></div>
            <h3>No family records yet</h3>
            <p style={{ opacity: 0.8 }}>
              Add a parent or sibling with a known condition to see how it relates to
              your own results.
            </p>
          </article>
        ) : (
          members.map((m) => (
            <article className="card" key={m.id}
              style={{ padding: '1rem 1.25rem', marginBottom: '0.75rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <b>{m.name}</b>
                <span style={{ opacity: 0.65 }}> · {m.relation}</span>
                {m.birth_year && <span style={{ opacity: 0.65 }}> · born {m.birth_year}</span>}
                <div style={{ marginTop: 4, opacity: 0.8 }}>
                  {m.conditions.length ? m.conditions.join(' · ') : 'No conditions recorded'}
                </div>
              </div>
              <button className="btn ghost" onClick={() => remove(m)}
                aria-label={`Remove ${m.name}`}>
                <X size={15} />
              </button>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
