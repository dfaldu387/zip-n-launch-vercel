import { supabase } from '@/lib/supabaseClient';

/**
 * Builds an opaque, URL-safe token that encodes the project + recipient EMAIL so
 * a public page (judge-request or upload-request) can resolve every group that
 * person was asked about — across ALL disciplines, not just one. The token IS
 * the access capability (scoped link, no login).
 */
export function makeRecipientToken(projectId, email) {
  const raw = `${projectId}:${String(email).trim().toLowerCase()}`;
  // base64url encode (browser btoa) — strip padding, swap +/ for -_
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Reverse of makeRecipientToken — returns { projectId, email } or null. */
export function parseRecipientToken(token) {
  try {
    const b64 = token.replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(b64);
    const idx = raw.indexOf(':');
    if (idx === -1) return null;
    return { projectId: raw.slice(0, idx), email: raw.slice(idx + 1) };
  } catch {
    return null;
  }
}

/**
 * Formats a start/end date pair (YYYY-MM-DD strings) into a readable range,
 * e.g. "Jun 18 – Jun 20, 2026". Returns '' when dates are missing.
 */
function formatDateRange(startDate, endDate) {
  if (!startDate) return '';
  // Parse as local dates (avoid UTC off-by-one) by splitting the ISO string
  const toLocal = (s) => {
    const [y, m, d] = String(s).split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  };
  const start = toLocal(startDate);
  if (!start) return '';
  const opts = { month: 'short', day: 'numeric' };
  const startStr = start.toLocaleDateString('en-US', opts);
  const end = endDate ? toLocal(endDate) : null;
  if (!end || end.getTime() === start.getTime()) {
    return `${startStr}, ${start.getFullYear()}`;
  }
  const endStr = end.toLocaleDateString('en-US', { ...opts, year: 'numeric' });
  return `${startStr} – ${endStr}`;
}

/**
 * The show classes that make up a pattern group, formatted like the builder
 * (custom- prefix stripped, Go 1/Go 2 suffix). Used so request emails and the
 * close-out tracking panel can show which classes each group covers.
 */
export function groupClassNames(group) {
  return ((group?.divisions) || [])
    .map((d) => {
      let name = String(d?.customTitle || d?.division || '').trim();
      if (name.startsWith('custom-')) name = name.slice(7);
      if (d?.goNumber === 2) name += ' (Go 2)';
      else if (d?.goNumber === 1 && d?.hasGo2) name += ' (Go 1)';
      return name;
    })
    .filter(Boolean);
}

/**
 * Walks patternSelections and collects every outstanding pattern request,
 * grouped by RECIPIENT EMAIL so each person gets exactly one email even when
 * they appear across multiple disciplines (the "Sissy does 3 disciplines →
 * one email" rule).
 *
 * Two kinds of request are collected:
 *   - kind 'judge'  → discipline set to "Judge Picks Pattern" (type
 *     'judgeAssigned') with a judgeEmail. The judge will PICK a pattern.
 *   - kind 'custom' → discipline set to "Custom Pattern" (type 'customRequest')
 *     with a requestedFromEmail. That person will UPLOAD a pattern.
 *
 * @param {object} formData
 * @param {object} [filter]
 * @param {string} [filter.disciplineId] - only this discipline's requests
 * @param {string} [filter.onlyEmail]    - only this recipient (case-insensitive)
 * @param {boolean}[filter.force]         - include already-sent requests (resend)
 *
 * @returns {{ recipients: Array, skipped: number }} where each recipient is
 *   { email, name, phone, items:[{disciplineId, groupId, discipline, groupName, judge, notes, kind}], refs:[{disciplineId,groupId}], kinds:Set<string> }
 */
export function collectRecipients(formData, filter = {}) {
  const { patternSelections, disciplines } = formData;
  const { disciplineId: onlyDisciplineId, onlyEmail, force = false } = filter;

  const onlyEmailLc = onlyEmail ? onlyEmail.trim().toLowerCase() : null;
  const disciplineMap = {};
  (disciplines || []).forEach((d) => { disciplineMap[d.id] = d.name || d.id; });

  const byEmail = new Map(); // emailLc -> recipient
  let skipped = 0;

  for (const [disciplineId, groups] of Object.entries(patternSelections || {})) {
    if (onlyDisciplineId && disciplineId !== onlyDisciplineId) continue;
    if (!groups || typeof groups !== 'object') continue;

    const discipline = (disciplines || []).find((d) => d.id === disciplineId);

    for (const [groupId, selection] of Object.entries(groups)) {
      // Decide the request kind + recipient for this group.
      let kind = null;
      let email = '';
      let name = '';
      let phone = '';

      if (selection?.type === 'judgeAssigned') {
        kind = 'judge';
        email = (selection.judgeEmail || '').trim();
        name = (selection.judgeName || '').trim();
        phone = (selection.judgePhone || '').trim();
      } else if (selection?.type === 'customRequest' && selection.customPatternRequested) {
        kind = 'custom';
        email = (selection.requestedFromEmail || '').trim();
        name = (selection.requestedFromName || '').trim();
        phone = (selection.requestedFromPhone || '').trim();
      } else {
        continue; // standard pattern or unset — nothing to request
      }

      // Never re-request a COMPLETED item (judge responded / custom uploaded) —
      // even on a forced resend, you don't ask for something already provided.
      if (['responded', 'uploaded'].includes(selection.requestStatus)) continue;
      // Skip already-sent (awaiting) items unless the caller forces a resend.
      if (!force && selection.requestStatus === 'email_sent') continue;

      // Incomplete request (missing name/email) — count so the caller can warn.
      if (!email || !name) { skipped += 1; continue; }

      const emailLc = email.toLowerCase();
      if (onlyEmailLc && emailLc !== onlyEmailLc) continue;

      const group = (discipline?.patternGroups || []).find((g) => g.id === groupId);
      const groupName = group?.name || `Group ${groupId}`;

      if (!byEmail.has(emailLc)) {
        byEmail.set(emailLc, { email, name, phone, items: [], refs: [], kinds: new Set() });
      }
      const recipient = byEmail.get(emailLc);
      recipient.kinds.add(kind);
      if (!recipient.phone && phone) recipient.phone = phone;
      recipient.items.push({
        disciplineId,
        groupId,
        discipline: disciplineMap[disciplineId] || disciplineId,
        groupName,
        classes: groupClassNames(group),
        judge: kind === 'judge' ? name : (selection.judgeName || ''),
        notes: selection.requestNotes || '',
        kind,
      });
      recipient.refs.push({ disciplineId, groupId });
    }
  }

  return { recipients: Array.from(byEmail.values()), skipped };
}

/**
 * Builds a tracking summary of EVERY pattern request in the book (sent or not),
 * grouped by recipient, for the "Pattern Requests" panel on the close-out step.
 *
 * Per-item status:
 *   - 'done'    → judge picked a pattern / custom file uploaded
 *   - 'sent'    → request email sent, awaiting response
 *   - 'pending' → not requested yet
 *
 * @returns {{ recipients: Array, totals: {recipients, items, pending, sent, done} }}
 */
export function summarizeRequests(formData) {
  const { patternSelections, disciplines } = formData;
  const disciplineMap = {};
  (disciplines || []).forEach((d) => { disciplineMap[d.id] = d.name || d.id; });

  const byKey = new Map();
  const totals = { recipients: 0, items: 0, pending: 0, sent: 0, done: 0 };

  for (const [disciplineId, groups] of Object.entries(patternSelections || {})) {
    if (!groups || typeof groups !== 'object') continue;
    const discipline = (disciplines || []).find((d) => d.id === disciplineId);

    for (const [groupId, sel] of Object.entries(groups)) {
      let kind = null;
      let email = '';
      let name = '';
      let phone = '';
      let status = 'pending';

      if (sel?.type === 'judgeAssigned' && sel.judgeName) {
        kind = 'judge';
        email = (sel.judgeEmail || '').trim();
        name = (sel.judgeName || '').trim();
        phone = (sel.judgePhone || '').trim();
        if (sel.requestStatus === 'responded' || sel.patternId) status = 'done';
        else if (sel.requestStatus === 'email_sent') status = 'sent';
      } else if (sel?.type === 'customRequest' && sel.customPatternRequested) {
        kind = 'custom';
        email = (sel.requestedFromEmail || '').trim();
        name = (sel.requestedFromName || '').trim();
        phone = (sel.requestedFromPhone || '').trim();
        if (sel.requestStatus === 'uploaded') status = 'done';
        else if (sel.requestStatus === 'email_sent') status = 'sent';
      } else {
        continue;
      }

      const group = (discipline?.patternGroups || []).find((g) => g.id === groupId);
      const groupName = group?.name || `Group ${groupId}`;
      const classes = groupClassNames(group);
      const key = email ? email.toLowerCase() : `noemail:${kind}:${name.toLowerCase()}`;

      if (!byKey.has(key)) {
        byKey.set(key, {
          key, email, name, phone, kinds: new Set(),
          items: [], counts: { total: 0, pending: 0, sent: 0, done: 0 },
          hasContact: !!(email && name),
        });
      }
      const r = byKey.get(key);
      r.kinds.add(kind);
      if (!r.phone && phone) r.phone = phone;
      r.items.push({ disciplineId, groupId, discipline: disciplineMap[disciplineId] || disciplineId, groupName, classes, kind, status });
      r.counts.total += 1;
      r.counts[status] += 1;

      totals.items += 1;
      totals[status] += 1;
    }
  }

  const recipients = Array.from(byKey.values()).map((r) => ({
    ...r,
    // Can send if we have a name+email and at least one item not yet completed.
    canSend: r.hasContact && (r.counts.pending + r.counts.sent) > 0,
  }));
  totals.recipients = recipients.length;

  return { recipients, totals };
}

/**
 * Sends ONE consolidated request email per recipient and returns an updated
 * copy of patternSelections with requestStatus marked 'email_sent' for every
 * group that went out. Never throws — failures are logged and counted.
 *
 * Backwards compatible: callers that pass { disciplineId } still work (it now
 * just scopes the collection). Pass { onlyEmail } to send to a single person
 * (used by the per-recipient "Send" buttons), or nothing to send to everyone.
 *
 * @returns { patternSelections, sent, failed, skipped }
 */
export async function sendCustomPatternRequests(formData, options = {}) {
  const { patternSelections, showName, venueName, venueAddress, startDate, endDate, id: projectId } = formData;

  if (!patternSelections) {
    return { patternSelections, sent: 0, failed: 0, skipped: 0 };
  }

  const { recipients, skipped } = collectRecipients(formData, options);
  if (recipients.length === 0) {
    return { patternSelections, sent: 0, failed: 0, skipped };
  }

  const showDates = formatDateRange(startDate, endDate);

  // Base URL for the public pages (falls back to production when no window).
  const origin = (typeof window !== 'undefined' && window.location?.origin)
    ? window.location.origin
    : 'https://equipatterns.com';

  // Clone selections so we can mark statuses without mutating state.
  const updatedSelections = JSON.parse(JSON.stringify(patternSelections));

  const results = await Promise.allSettled(
    recipients.map(async ({ email, name, phone, items, refs, kinds }) => {
      // Scoped, no-login links keyed to this recipient (spans all disciplines).
      const token = projectId ? makeRecipientToken(projectId, email) : '';
      const judgeLink = token && kinds.has('judge') ? `${origin}/judge-request/${token}` : '';
      const uploadLink = token && kinds.has('custom') ? `${origin}/upload-request/${token}` : '';

      const payload = {
        recipientEmail: email,
        recipientName: name,
        recipientPhone: phone || '',
        showName: showName || 'Untitled Show',
        showDates: showDates || '',
        venue: venueName || '',
        location: venueAddress || '',
        items, // [{ discipline, groupName, classes, judge, notes, kind }]
        judgeLink,
        uploadLink,
      };

      const { data, error } = await supabase.functions.invoke(
        'send-custom-pattern-request',
        { body: JSON.stringify(payload) },
      );

      if (error || data?.error) {
        console.error(`Failed to send pattern request to ${email}:`, error?.message || data?.error);
        return { refs, success: false };
      }
      return { refs, success: true };
    }),
  );

  let sent = 0;
  let failed = 0;
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.success) {
      sent += 1;
      for (const { disciplineId, groupId } of result.value.refs) {
        const grp = updatedSelections[disciplineId]?.[groupId];
        // Never downgrade a completed item back to "sent".
        if (grp && grp.requestStatus !== 'uploaded' && grp.requestStatus !== 'responded') {
          grp.requestStatus = 'email_sent';
          grp.requestSentAt = new Date().toISOString();
        }
      }
    } else {
      failed += 1;
    }
  }

  return { patternSelections: updatedSelections, sent, failed, skipped };
}
