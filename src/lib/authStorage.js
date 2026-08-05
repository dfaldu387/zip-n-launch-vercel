// Storage for the Supabase session, switchable by the "Remember me" checkbox.
//
// The checkbox used to be decorative: it was read and written in the sign-in form
// but never used, and the session always went to localStorage. So on a shared or
// public computer someone could untick it, close the browser, and still be signed
// in the next time the machine was used.
//
//   remember on  (default) → localStorage   : session survives closing the browser
//   remember off           → sessionStorage : session ends with the browser tab
//
// The preference itself is a plain setting, not a credential, so it lives in
// localStorage — that is how we still know the choice on the next visit.

const REMEMBER_KEY = 'ep-remember-me';

// Every browser here supports both stores, but private-browsing modes can throw
// on access. A failure to remember must never break signing in, so each call is
// guarded and falls back to "no stored value".
const safely = (fn, fallback = null) => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

const local = () => window.localStorage;
const session = () => window.sessionStorage;

/** Defaults to true so existing signed-in users are not logged out by this change. */
export const isRememberMe = () =>
  safely(() => local().getItem(REMEMBER_KEY) !== 'false', true);

/**
 * Records the choice and moves any session already stored into the right place,
 * so ticking or unticking the box takes effect immediately rather than at the
 * next sign-in.
 */
export const setRememberMe = (remember) => {
  safely(() => local().setItem(REMEMBER_KEY, remember ? 'true' : 'false'));

  const from = remember ? session() : local();
  const to = remember ? local() : session();

  safely(() => {
    // Copy first, then delete, so an interrupted move cannot lose the session.
    const keys = [];
    for (let i = 0; i < from.length; i += 1) {
      const key = from.key(i);
      if (key && key.startsWith('sb-')) keys.push(key);
    }
    keys.forEach((key) => {
      const value = from.getItem(key);
      if (value !== null) to.setItem(key, value);
    });
    keys.forEach((key) => from.removeItem(key));
  });
};

// Passed to createClient as its `storage`. Reads look in both stores so a session
// is found whichever mode it was saved under; writes go to the chosen one only.
export const authStorage = {
  getItem: (key) =>
    safely(() => local().getItem(key)) ?? safely(() => session().getItem(key)),

  setItem: (key, value) => {
    if (isRememberMe()) {
      safely(() => local().setItem(key, value));
      safely(() => session().removeItem(key));
    } else {
      safely(() => session().setItem(key, value));
      safely(() => local().removeItem(key));
    }
  },

  removeItem: (key) => {
    safely(() => local().removeItem(key));
    safely(() => session().removeItem(key));
  },
};
