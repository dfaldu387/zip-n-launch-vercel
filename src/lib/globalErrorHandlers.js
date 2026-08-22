import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';

// ErrorBoundary only catches errors thrown while React is rendering. A failed
// `await` with no .catch (network drop, Supabase timeout, an edge function that
// never answers) produced an unhandled rejection instead: the spinner kept
// spinning and the user was told nothing. These handlers make sure something
// always reaches the screen and the console.

// Several rejections often arrive together from one dropped connection. One
// message per burst is enough — more just buries the page in toasts.
const TOAST_COOLDOWN_MS = 5000;
let lastToastAt = 0;

const notify = (title, description) => {
  const now = Date.now();
  if (now - lastToastAt < TOAST_COOLDOWN_MS) return;
  lastToastAt = now;
  toast({ title, description, variant: 'destructive' });
};

const messageOf = (reason) => {
  if (!reason) return '';
  if (typeof reason === 'string') return reason;
  return reason.message || reason.error_description || reason.msg || '';
};

// A request the browser cancelled on purpose (component unmounted, user navigated
// away mid-fetch). Nothing broke, so nothing should be reported.
const isCancellation = (reason) => {
  const name = reason?.name || '';
  if (name === 'AbortError' || name === 'CanceledError') return true;
  return /aborted|cancell?ed/i.test(messageOf(reason));
};

// The stored session is no longer valid — the refresh token was revoked, expired,
// or cleared on the server. supabase-js keeps retrying and throwing, so the user
// saw a burst of red pop-ups reading "Invalid Refresh Token: Refresh Token Not
// Found" and every request kept failing, because the dead tokens stayed in the
// browser. Nothing told them the fix was simply to sign in again.
// Matching on any mention of a refresh token, rather than one exact sentence.
// Supabase words this differently depending on why it failed — "Refresh Token Not
// Found", "Refresh token is not valid", "refresh_token_not_found" — and an
// earlier version of this check listed some of them and missed the one the
// server actually sends. Whatever the wording, an error about the refresh token
// means the same thing: this session is dead.
const isExpiredSession = (reason) => {
  const message = messageOf(reason);
  return /refresh[_ ]?token/i.test(message)
      || /session[_ ]not[_ ]found|jwt expired/i.test(message);
};

// Clearing it locally is enough: the server-side session is already gone, and a
// network round-trip could fail and leave the bad tokens in place.
let clearingSession = false;
const clearDeadSession = () => {
  if (clearingSession) return;
  clearingSession = true;
  Promise.resolve(supabase.auth.signOut({ scope: 'local' }))
    .catch(() => { /* already gone */ })
    .finally(() => { clearingSession = false; });
};

const isNetworkFailure = (reason) =>
  /failed to fetch|networkerror|network request failed|load failed/i.test(messageOf(reason));

export const registerGlobalErrorHandlers = () => {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    if (isCancellation(reason)) return;

    console.error('Unhandled promise rejection:', reason);

    if (isExpiredSession(reason)) {
      clearDeadSession();
      notify('Your session has expired', 'Please sign in again to continue.');
      return;
    }

    if (isNetworkFailure(reason)) {
      notify(
        'Connection problem',
        'We could not reach the server. Check your internet connection and try again.'
      );
      return;
    }

    notify(
      'Something went wrong',
      messageOf(reason) || 'The last action did not finish. Please try again.'
    );
  });

  // Errors thrown outside React (event handlers, timers, third-party scripts).
  window.addEventListener('error', (event) => {
    // Failed <img>/<script> loads also fire this, on the element rather than window.
    if (event.target && event.target !== window) return;
    console.error('Uncaught error:', event.error || event.message);
  });
};
