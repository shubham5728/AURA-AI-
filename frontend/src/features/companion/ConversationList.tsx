/**
 * The list of chat threads, in the style of ChatGPT or Gemini.
 *
 * Each conversation is stored server-side and titled by its first message, so
 * starting a new chat no longer means losing the last one -- the old threads
 * stay here to reopen. Lives in the companion's left column, above the trace
 * of how the current answer was produced.
 */

import { MessageSquare, Plus, Trash2 } from 'lucide-react';
import type { Conversation } from '../../lib/types';

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  onNew: () => void;
  onSelect: (id: string | null) => void;
  onDelete: (id: string | null) => void;
}

/** A stable key even for the legacy thread, whose id is null. */
const keyOf = (id: string | null) => id ?? 'legacy';

export default function ConversationList({
  conversations,
  activeId,
  onNew,
  onSelect,
  onDelete,
}: Props) {
  return (
    <div style={{ marginBottom: 'var(--space-4)' }}>
      <button
        className="btn primary"
        onClick={onNew}
        style={{ width: '100%', justifyContent: 'center', marginBottom: 'var(--space-3)' }}
      >
        <Plus size={16} /> New chat
      </button>

      <div className="card-label" style={{ marginBottom: 'var(--space-2)' }}>
        YOUR CONVERSATIONS
      </div>

      {conversations.length === 0 ? (
        <small style={{ opacity: 0.6 }}>
          No past chats yet. This one starts the list.
        </small>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 260, overflowY: 'auto' }}>
          {conversations.map((c) => {
            const active = c.conversation_id === activeId;
            return (
              <div
                key={keyOf(c.conversation_id)}
                onClick={() => onSelect(c.conversation_id)}
                title={c.title}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 10px', borderRadius: 10, cursor: 'pointer',
                  background: active ? 'var(--accent-soft, rgba(37,99,235,0.12))' : 'transparent',
                  color: active ? 'var(--accent, #2563eb)' : 'inherit',
                }}
              >
                <MessageSquare size={14} style={{ flexShrink: 0, opacity: 0.7 }} />
                <span style={{
                  flex: 1, minWidth: 0, fontSize: 'var(--text-small)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {c.title}
                </span>
                <button
                  aria-label="Delete conversation"
                  onClick={(e) => { e.stopPropagation(); onDelete(c.conversation_id); }}
                  style={{
                    flexShrink: 0, background: 'none', border: 'none', padding: 2,
                    cursor: 'pointer', color: 'inherit', opacity: 0.5, display: 'grid', placeItems: 'center',
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
