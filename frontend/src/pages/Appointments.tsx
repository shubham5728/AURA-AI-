/**
 * Doctor appointments: add, list, remind, remove.
 *
 * AURA books nothing and has no clinic network, so this is honest by design --
 * it records the visit the user arranged themselves and turns it into a calendar
 * reminder. No invented doctors, no fake "confirmed" slots. Upcoming visits are
 * separated from past ones because the next visit is the one that matters today.
 */

import { useEffect, useState } from 'react';
import { CalendarClock, CalendarPlus, MapPin, Plus, Stethoscope, X } from 'lucide-react';
import { del, get, post } from '../lib/api';
import { downloadIcs } from '../lib/calendar';
import type { Appointment } from '../lib/types';

/** Local datetime string for an <input type="datetime-local"> default. */
function localDatetime(daysFromNow: number, hour = 10): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

export default function AppointmentsPage() {
  const [items, setItems] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [doctor, setDoctor] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [when, setWhen] = useState(localDatetime(2));
  const [reason, setReason] = useState('');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setItems(await get<Appointment[]>('/api/appointments'));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load appointments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctor.trim()) return;
    setSaving(true);
    setError('');
    try {
      await post('/api/appointments', {
        doctor_name: doctor.trim(),
        specialty: specialty.trim() || null,
        scheduled_at: new Date(when).toISOString(),
        reason: reason.trim() || null,
        location: location.trim() || null,
      });
      setDoctor(''); setSpecialty(''); setReason(''); setLocation('');
      setWhen(localDatetime(2));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this appointment');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (a: Appointment) => {
    await del(`/api/appointments/${a.id}`);
    await load();
  };

  const addToCalendar = (a: Appointment) => {
    downloadIcs(
      {
        title: `Appointment: ${a.doctor_name}${a.specialty ? ` (${a.specialty})` : ''}`,
        description:
          [a.reason ? `Reason: ${a.reason}` : '', a.location ? `Location: ${a.location}` : '',
            a.notes || '',
            'Reminder created from AURA. AURA does not book visits — arrange it with your clinic.']
            .filter(Boolean).join('\n\n'),
        start: new Date(a.scheduled_at),
        durationMinutes: 30,
      },
      'appointment.ics',
    );
  };

  const now = Date.now();
  const upcoming = items.filter((a) => new Date(a.scheduled_at).getTime() >= now);
  const past = items.filter((a) => new Date(a.scheduled_at).getTime() < now).reverse();

  const row = (a: Appointment, isPast: boolean) => (
    <div className="card" key={a.id}
      style={{ padding: '1rem 1.25rem', marginBottom: '0.75rem', opacity: isPast ? 0.65 : 1,
        display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <b style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Stethoscope size={15} /> {a.doctor_name}
          {a.specialty && <span style={{ opacity: 0.6, fontWeight: 400 }}>· {a.specialty}</span>}
        </b>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 'var(--text-small)' }}>
          <CalendarClock size={14} /> {formatWhen(a.scheduled_at)}
        </div>
        {a.reason && <div style={{ marginTop: 4, fontSize: 'var(--text-small)', opacity: 0.85 }}>{a.reason}</div>}
        {a.location && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 'var(--text-small)', opacity: 0.7 }}>
            <MapPin size={13} /> {a.location}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {!isPast && (
          <button className="btn ghost" onClick={() => addToCalendar(a)}>
            <CalendarPlus size={15} /> Calendar
          </button>
        )}
        <button className="btn ghost" onClick={() => remove(a)} aria-label="Remove appointment">
          <X size={15} />
        </button>
      </div>
    </div>
  );

  return (
    <main className="page">
      <header className="page-head">
        <div>
          <h1>Doctor Appointments</h1>
          <p>Keep track of visits you've arranged and add them to your calendar. AURA does
            not book appointments — it helps you remember them.</p>
        </div>
      </header>

      <form className="card" style={{ padding: '1.5rem', maxWidth: 760 }} onSubmit={add}>
        <span className="card-label">ADD AN APPOINTMENT</span>
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
          <label>Doctor / clinic
            <input value={doctor} onChange={(e) => setDoctor(e.target.value)} placeholder="Dr. Mehta" required />
          </label>
          <label>Specialty
            <input value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="Cardiology" />
          </label>
          <label>Date &amp; time
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)}
              style={{ colorScheme: 'light dark' }} required />
          </label>
          <label>Reason
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Routine check-up" />
          </label>
          <label>Location
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City Clinic" />
          </label>
        </div>
        <button className="btn primary" style={{ marginTop: '1rem' }} disabled={saving}>
          <Plus size={16} /> {saving ? 'Saving…' : 'Add appointment'}
        </button>
      </form>

      {error && <div className="error" style={{ marginTop: '1rem' }}>{error}</div>}

      <section style={{ marginTop: '2rem', maxWidth: 760 }}>
        <span className="card-label">UPCOMING</span>
        {loading ? (
          <p style={{ opacity: 0.7 }}>Loading…</p>
        ) : upcoming.length === 0 ? (
          <p style={{ opacity: 0.7 }}>No upcoming appointments. Add one above.</p>
        ) : (
          <div style={{ marginTop: '0.75rem' }}>{upcoming.map((a) => row(a, false))}</div>
        )}
      </section>

      {past.length > 0 && (
        <section style={{ marginTop: '2rem', maxWidth: 760 }}>
          <span className="card-label">PAST</span>
          <div style={{ marginTop: '0.75rem' }}>{past.map((a) => row(a, true))}</div>
        </section>
      )}
    </main>
  );
}
