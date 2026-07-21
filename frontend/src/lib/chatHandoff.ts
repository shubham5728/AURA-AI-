/**
 * A one-time handoff of a question into the AI Companion's composer.
 *
 * Screens that reach a point where "ask AURA about this" is the natural next
 * step -- a triage result, a concern on the overview -- stash a draft here and
 * navigate to the companion. The companion reads it once on mount and clears
 * it, so the text lands in the composer ready to send or edit.
 *
 * Deliberately a *draft*, not an auto-sent message: the user still decides what
 * to ask. It carries no health data of its own -- only the plain-language
 * question the screen already showed -- and it is single-use, so a stale
 * question never reappears on a later visit to the chat.
 */

const KEY = 'aura.chatDraft';

/** Store a question for the companion to pick up on its next mount. */
export function stashChatDraft(question: string): void {
  try {
    sessionStorage.setItem(KEY, question);
  } catch {
    // Private-mode or storage-disabled: the handoff simply doesn't happen, and
    // the user lands on an empty composer. No data is lost.
  }
}

/** Read the pending question, if any, and clear it so it is used only once. */
export function takeChatDraft(): string | null {
  try {
    const draft = sessionStorage.getItem(KEY);
    if (draft) sessionStorage.removeItem(KEY);
    return draft;
  } catch {
    return null;
  }
}
