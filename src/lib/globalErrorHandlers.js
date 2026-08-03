import { toast } from '@/components/ui/use-toast';

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

const isNetworkFailure = (reason) =>
  /failed to fetch|networkerror|network request failed|load failed/i.test(messageOf(reason));

export const registerGlobalErrorHandlers = () => {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    if (isCancellation(reason)) return;

    console.error('Unhandled promise rejection:', reason);

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
