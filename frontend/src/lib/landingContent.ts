/**
 * Copy for the public landing page.
 *
 * This lived in a database table and was fetched at page load. It is static
 * marketing text that never varies by user, so a network round trip bought
 * nothing and cost a loading state on the first screen anyone sees -- and when
 * the table went away, three sections silently rendered empty.
 *
 * Content the server does not personalise belongs in the bundle.
 */

export interface ContentRow {
  id: string;
  kind: 'problem' | 'workflow' | 'timeline';
  title: string;
  body: string;
}

export const LANDING_CONTENT: ContentRow[] = [
  {
    id: 'p1',
    kind: 'problem',
    title: 'Reactive healthcare',
    body: 'Care often begins after symptoms escalate, missing the window for prevention.',
  },
  {
    id: 'p2',
    kind: 'problem',
    title: 'Fragmented records',
    body: 'Reports, prescriptions, wearables, and habits live in disconnected systems.',
  },
  {
    id: 'p3',
    kind: 'problem',
    title: 'Complex reports',
    body: 'Clinical language leaves people unsure what results mean for daily life.',
  },
  {
    id: 'p4',
    kind: 'problem',
    title: 'Limited consultation time',
    body: 'Important context can be lost during brief, high-pressure appointments.',
  },
  {
    id: 'p5',
    kind: 'problem',
    title: 'Generic advice',
    body: 'One-size guidance overlooks individual history, goals, and constraints.',
  },
  {
    id: 'p6',
    kind: 'problem',
    title: 'Lifestyle disease burden',
    body: 'Slow-moving risks need continuous intelligence, not occasional snapshots.',
  },

  { id: 'w1', kind: 'workflow', title: 'User data', body: 'Records, habits & wearables' },
  { id: 'w2', kind: 'workflow', title: 'AI processing', body: 'Secure normalization' },
  { id: 'w3', kind: 'workflow', title: 'Digital Twin', body: 'Living health model' },
  { id: 'w4', kind: 'workflow', title: 'Multi-Agent AI', body: 'Specialist reasoning' },
  { id: 'w5', kind: 'workflow', title: 'Personalized insight', body: 'Clear next steps' },
  { id: 'w6', kind: 'workflow', title: 'Better health', body: 'Proactive decisions' },

  {
    id: 't1',
    kind: 'timeline',
    title: 'Connect the full picture',
    body: 'AURA combines clinical history, lifestyle, nutrition, sleep, movement and wearable signals.',
  },
  {
    id: 't2',
    kind: 'timeline',
    title: 'Build your Digital Twin',
    body: 'A dynamic health model adapts whenever your signals, goals, or care plan changes.',
  },
  {
    id: 't3',
    kind: 'timeline',
    title: 'Reason with specialist agents',
    body: 'Doctor, Nutrition, Fitness, Medication, and Prediction Agents collaborate with shared context.',
  },
  {
    id: 't4',
    kind: 'timeline',
    title: 'Act before risk becomes illness',
    body: 'Understand trends early and bring better questions and evidence to qualified clinicians.',
  },
];
