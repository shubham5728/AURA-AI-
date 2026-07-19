/**
 * Renders the small subset of Markdown that model replies actually use.
 *
 * Replies came back containing `**Please remember:**` and `* ` bullets, which
 * were being printed as literal asterisks. Health guidance that reads like
 * broken output undermines the content itself.
 *
 * Written by hand rather than pulled in as a dependency for two reasons. The
 * needed subset is tiny -- paragraphs, bullets, bold, and numbered points --
 * and a general Markdown renderer accepts raw HTML by default, which means
 * model output would become an injection surface in an app holding medical
 * records. Nothing here interprets HTML: text is placed as text nodes, so a
 * reply containing a script tag renders as the characters of a script tag.
 */

import type { ReactNode } from 'react';

/** Splits on **bold**, leaving the surrounding text intact. */
function inline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /\*\*(.+?)\*\*/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push(<strong key={`${match.index}`}>{match[1]}</strong>);
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length ? parts : [text];
}

const BULLET = /^\s*[*-]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;

export default function Markdown({ text }: { text: string }) {
  const lines = text.split('\n');
  const blocks: ReactNode[] = [];

  let paragraph: string[] = [];
  let bullets: string[] = [];
  let numbered: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(
      <p key={`p${blocks.length}`} style={{ margin: '0 0 0.75rem' }}>
        {inline(paragraph.join(' '))}
      </p>,
    );
    paragraph = [];
  };

  const flushBullets = () => {
    if (!bullets.length) return;
    blocks.push(
      <ul key={`u${blocks.length}`} style={{ margin: '0 0 0.75rem', paddingLeft: '1.25rem' }}>
        {bullets.map((item, i) => (
          <li key={i} style={{ marginBottom: '0.3rem' }}>{inline(item)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  const flushNumbered = () => {
    if (!numbered.length) return;
    blocks.push(
      <ol key={`o${blocks.length}`} style={{ margin: '0 0 0.75rem', paddingLeft: '1.35rem' }}>
        {numbered.map((item, i) => (
          <li key={i} style={{ marginBottom: '0.3rem' }}>{inline(item)}</li>
        ))}
      </ol>,
    );
    numbered = [];
  };

  const flushAll = () => {
    flushParagraph();
    flushBullets();
    flushNumbered();
  };

  for (const line of lines) {
    const bullet = line.match(BULLET);
    const number = line.match(NUMBERED);

    if (bullet) {
      // A list interrupts a paragraph, so anything pending is closed first.
      flushParagraph();
      flushNumbered();
      bullets.push(bullet[1]);
    } else if (number) {
      flushParagraph();
      flushBullets();
      numbered.push(number[1]);
    } else if (line.trim() === '') {
      flushAll();
    } else {
      flushBullets();
      flushNumbered();
      paragraph.push(line.trim());
    }
  }
  flushAll();

  return <>{blocks}</>;
}
