/**
 * Generates a downloadable calendar event (.ics).
 *
 * Used to turn a triage result into a doctor-appointment reminder in the user's
 * own calendar. This is the honest version of "book an appointment": AURA has
 * no doctor network and no booking backend, so it does not pretend to confirm a
 * slot with a named clinic. It produces a standard calendar file that any app
 * -- Google, Apple, Outlook -- imports, and the user schedules the real visit
 * themselves.
 */

interface CalendarEvent {
  title: string;
  description: string;
  start: Date;
  /** Minutes. */
  durationMinutes?: number;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** UTC stamp in the basic format iCalendar requires: YYYYMMDDTHHMMSSZ. */
function stamp(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

/** Line breaks and commas are control characters in iCalendar text. */
function escape(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

export function buildIcs(event: CalendarEvent): string {
  const end = new Date(event.start.getTime() + (event.durationMinutes ?? 30) * 60_000);
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@aura.health`;

  // Folded at no line to keep it simple; these lines are well under the 75-char
  // limit for our content. CRLF is required by the spec.
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AURA Health//Symptom Triage//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(event.start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escape(event.title)}`,
    `DESCRIPTION:${escape(event.description)}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escape(event.title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

/** Triggers a download of the event as a .ics file. */
export function downloadIcs(event: CalendarEvent, filename = 'appointment.ics'): void {
  const blob = new Blob([buildIcs(event)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
