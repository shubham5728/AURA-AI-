/**
 * The doctor-appointment step shown after a triage result.
 *
 * Honest by construction: AURA has no clinic network and books nothing. Rather
 * than a throwaway inline reminder, this now hands the user into the Doctor
 * Appointments section -- carrying the symptom across as the reason -- where they
 * can save the visit properly and add it to their calendar. An emergency is not
 * something to schedule for next week, so that case points at care now instead.
 */

import { useNavigate } from 'react-router-dom';
import { CalendarPlus, MessageCircle, PhoneCall, Stethoscope } from 'lucide-react';
import { stashChatDraft } from '../../lib/chatHandoff';
import { STATUS_COLOUR } from '../../components/ui/tokens';

/** India's unified emergency number. Matches the one the safety layer uses. */
const EMERGENCY_NUMBER = '112';

interface Props {
  symptom: string;
  emergency: boolean;
}

export default function AppointmentReminder({ symptom, emergency }: Props) {
  const nav = useNavigate();

  // Carry the symptom into the Doctor Appointments form as the reason, so the
  // user lands there ready to save rather than re-typing what they just checked.
  const book = () => {
    nav('/app/appointments', { state: { reason: symptom } });
  };

  // Hand the symptom to the AI companion as a ready-to-send question, then open
  // the chat, which already reads the user's real health data.
  const discuss = () => {
    stashChatDraft(
      `I just did a symptom check for "${symptom}". Can you help me understand ` +
      `what might be going on and what I should watch for?`,
    );
    nav('/app/companion');
  };

  if (emergency) {
    // Scheduling is the wrong action for an emergency. The right next step is
    // immediate care, so this offers a one-tap call rather than a booking flow.
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

  return (
    <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid rgba(128,128,128,0.14)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-2)' }}>
        <Stethoscope size={16} />
        <b>See a doctor</b>
      </div>
      <p style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--text-small)', opacity: 0.75 }}>
        Book and track this visit in Doctor Appointments — your symptom is carried over as
        the reason, and you can add it to your calendar there. AURA does not book the visit;
        arrange it with your own doctor or clinic.
      </p>

      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        <button className="btn primary" onClick={book}>
          <CalendarPlus size={16} /> Book a doctor appointment
        </button>
        <button className="btn ghost" onClick={discuss}>
          <MessageCircle size={16} /> Discuss this with AURA
        </button>
      </div>
    </div>
  );
}
