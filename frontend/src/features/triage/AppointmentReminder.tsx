/**
 * The doctor-appointment step shown after a triage result.
 *
 * Honest by construction: AURA has no clinic network and no booking backend, so
 * it does not show fake doctors, fake slots, or a fake "confirmed" message. It
 * helps the user put a real reminder in their own calendar, pre-filled with the
 * symptom and the triage guidance, and leaves the actual booking to them.
 *
 * The default date follows the urgency the triage already decided: an emergency
 * is not something to schedule for next week, so that case points at care now
 * instead of offering a date picker at all.
 */

import { useState } from 'react';
import { CalendarPlus, PhoneCall, Stethoscope } from 'lucide-react';
import { downloadIcs } from '../../lib/calendar';
import { STATUS_COLOUR } from '../../components/ui/tokens';

/** India's unified emergency number. Matches the one the safety layer uses. */
const EMERGENCY_NUMBER = '112';

interface Props {
  symptom: string;
  guidance: string;
  emergency: boolean;
}

/** Local YYYY-MM-DD, a given number of days from today. */
function isoDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function AppointmentReminder({ symptom, guidance, emergency }: Props) {
  // Emergencies are handled by their own message, not by scheduling; every other
  // case defaults to a couple of days out, which the user can change.
  const [date, setDate] = useState(isoDate(2));
  const [time, setTime] = useState('10:00');
  const [added, setAdded] = useState(false);

  if (emergency) {
    // Scheduling is the wrong action for an emergency, but showing nothing is
    // too. The right next step is immediate care, so this offers a one-tap call
    // to emergency services rather than a date picker for next week.
    return (
      <div style={{
        marginTop: 'var(--space-4)', padding: 'var(--space-4)', borderRadius: 14,
        background: `${STATUS_COLOUR.urgent}12`, border: `1px solid ${STATUS_COLOUR.urgent}44`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: STATUS_COLOUR.urgent }}>
          <PhoneCall size={16} />
          <b>This needs urgent attention</b>
        </div>
        <p style={{ margin: '6px 0 var(--space-3)', fontSize: 'var(--text-small)', opacity: 0.85 }}>
          Do not wait for an appointment. Call emergency services now, or get to the
          nearest emergency room.
        </p>
        <a href={`tel:${EMERGENCY_NUMBER}`} className="btn primary"
          style={{ background: STATUS_COLOUR.urgent, borderColor: STATUS_COLOUR.urgent }}>
          <PhoneCall size={16} /> Call emergency services ({EMERGENCY_NUMBER})
        </a>
      </div>
    );
  }

  const add = () => {
    const start = new Date(`${date}T${time}`);
    downloadIcs(
      {
        title: 'Doctor appointment',
        description:
          `Reason: ${symptom}\n\n` +
          `AURA's assessment: ${guidance}\n\n` +
          'This reminder was created from AURA Symptom Triage. It is not a booking ' +
          'or a medical diagnosis — please arrange the visit with your doctor or clinic.',
        start,
        durationMinutes: 30,
      },
      'doctor-appointment.ics',
    );
    setAdded(true);
  };

  return (
    <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid rgba(128,128,128,0.14)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-2)' }}>
        <Stethoscope size={16} />
        <b>See a doctor</b>
      </div>
      <p style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--text-small)', opacity: 0.75 }}>
        Add a reminder to your calendar with this assessment attached. AURA does not book
        the visit — arrange it with your own doctor or clinic.
      </p>

      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="date" value={date} min={isoDate(0)}
          onChange={(e) => { setDate(e.target.value); setAdded(false); }}
          aria-label="Appointment date"
          style={{ padding: '9px 11px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)' }} />
        <input type="time" value={time}
          onChange={(e) => { setTime(e.target.value); setAdded(false); }}
          aria-label="Appointment time"
          style={{ padding: '9px 11px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)' }} />
        <button className="btn primary" onClick={add}>
          <CalendarPlus size={16} /> {added ? 'Added — check downloads' : 'Add to calendar'}
        </button>
      </div>
    </div>
  );
}
