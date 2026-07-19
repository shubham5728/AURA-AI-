/**
 * The upload target.
 *
 * The browser's own file control is hidden and replaced, because the default
 * "Choose File | No file chosen" gives no indication of what will happen to a
 * medical document once it is handed over.
 *
 * It is still a real `<input type="file">` underneath, wrapped in a label, so
 * keyboard focus, the file picker, and screen readers all behave as they
 * normally would. Rebuilding that from scratch with a div and a click handler
 * is where custom uploaders usually lose accessibility.
 */

import { useRef, useState } from 'react';
import { FileText, Loader2, Sparkles, Upload } from 'lucide-react';

interface Props {
  onFile: (file: File) => void;
  busy: boolean;
  maxMb: number;
  onSample?: () => void;
}

export default function UploadZone({ onFile, busy, maxMb, onSample }: Props) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = (file: File | undefined) => {
    if (file && !busy) onFile(file);
  };

  return (
    <div>
      <label
        className={dragging ? 'upload-zone drag' : 'upload-zone'}
        onDragOver={(e) => { e.preventDefault(); if (!busy) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          accept(e.dataTransfer.files[0]);
        }}
        style={{
          display: 'block',
          borderRadius: 18,
          padding: 'var(--space-5)',
          textAlign: 'center',
          cursor: busy ? 'progress' : 'pointer',
          transition: 'border-color .2s ease, background .2s ease, transform .2s ease',
          transform: dragging ? 'scale(1.005)' : undefined,
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,image/*"
          disabled={busy}
          onChange={(e) => accept(e.target.files?.[0])}
        />

        <div style={{
          width: 54, height: 54, borderRadius: 16, margin: '0 auto',
          display: 'grid', placeItems: 'center',
          background: 'rgba(56,132,232,0.12)', color: 'var(--blue)',
        }}>
          {busy
            ? <Loader2 size={24} className="twin-spin" />
            : dragging ? <FileText size={24} /> : <Upload size={24} />}
        </div>

        <h3 style={{ margin: 'var(--space-4) 0 var(--space-2)' }}>
          {busy ? 'Reading your report…' : dragging ? 'Drop it here' : 'Upload a lab report'}
        </h3>

        <p style={{ margin: 0, opacity: 0.75, maxWidth: 420, marginInline: 'auto' }}>
          {busy
            ? 'This usually takes a few seconds.'
            : 'AURA reads every value, compares it to the range printed on your report, and explains what each test measures.'}
        </p>

        {!busy && (
          <>
            <span className="btn primary" style={{ marginTop: 'var(--space-4)' }}>
              Choose a file
            </span>
            <div style={{ marginTop: 'var(--space-3)', fontSize: 'var(--text-caption)', opacity: 0.6 }}>
              PDF, PNG or JPG · up to {maxMb} MB · your file stays on your account
            </div>
          </>
        )}
      </label>

      {/* A first-time visitor with no report to hand can still see the whole
          flow. It runs the real pipeline on a real file -- nothing about the
          result is pre-recorded. */}
      {onSample && !busy && (
        <div style={{ textAlign: 'center', marginTop: 'var(--space-4)' }}>
          <span style={{ opacity: 0.65, fontSize: 'var(--text-small)' }}>
            No report to hand?{' '}
          </span>
          <button className="btn ghost" style={{ padding: '6px 12px' }} onClick={onSample}>
            <Sparkles size={14} /> Try a sample report
          </button>
        </div>
      )}
    </div>
  );
}
