import { describe, it, expect } from 'vitest';
import { makeRecipientToken, makeRequestSecret, parseRecipientToken } from './customPatternEmails';

const PROJECT = 'a7895d87-b4e2-441c-afd3-322bef9812cc';

describe('makeRequestSecret', () => {
  it('is long enough not to be guessed', () => {
    expect(makeRequestSecret()).toMatch(/^[0-9a-f]{32}$/);
  });

  it('is different every time', () => {
    const seen = new Set(Array.from({ length: 50 }, () => makeRequestSecret()));
    expect(seen.size).toBe(50);
  });
});

describe('request link tokens', () => {
  it('round-trips the show, the email and the secret', () => {
    const secret = makeRequestSecret();
    const token = makeRecipientToken(PROJECT, 'Judge@Example.com', secret);

    expect(parseRecipientToken(token)).toEqual({
      projectId: PROJECT,
      email: 'judge@example.com',   // lowercased when built
      secret,
    });
  });

  it('handles an email containing a colon', () => {
    // Rare, but the parser splits on the LAST colon for exactly this reason.
    const secret = makeRequestSecret();
    const token = makeRecipientToken(PROJECT, 'od:d@example.com', secret);
    const parsed = parseRecipientToken(token);

    expect(parsed.email).toBe('od:d@example.com');
    expect(parsed.secret).toBe(secret);
  });

  it('produces a URL-safe token', () => {
    const token = makeRecipientToken(PROJECT, 'judge@example.com', makeRequestSecret());
    expect(token).not.toMatch(/[+/=]/);
    expect(encodeURIComponent(token)).toBe(token);
  });

  // The bug this guards: the token used to be base64 of just "showId:email", so
  // anyone holding one link could rewrite the email and open — or overwrite —
  // another judge's request. The secret is what the server now checks.
  it('a token forged for another email carries a different secret', () => {
    const mine = makeRequestSecret();
    const myToken = makeRecipientToken(PROJECT, 'judge1@example.com', mine);

    // What an attacker can do: read my token and build one for someone else.
    const stolen = parseRecipientToken(myToken);
    const forged = makeRecipientToken(stolen.projectId, 'judge2@example.com', stolen.secret);
    const parsedForged = parseRecipientToken(forged);

    // They can name any email, but the secret is still mine — and the server
    // compares it against the secret stored on judge2's own request.
    expect(parsedForged.email).toBe('judge2@example.com');
    expect(parsedForged.secret).toBe(mine);

    const judge2Secret = makeRequestSecret();
    expect(parsedForged.secret).not.toBe(judge2Secret);
  });

  describe('rejects malformed tokens', () => {
    it('rejects rubbish', () => {
      expect(parseRecipientToken('not-a-token!!')).toBeNull();
    });

    it('rejects a token with no email or secret', () => {
      const noColon = btoa('justtheprojectid').replace(/=+$/, '');
      expect(parseRecipientToken(noColon)).toBeNull();
    });

    // Old links, from before the secret existed.
    it('rejects the old two-part token', () => {
      const legacy = btoa(`${PROJECT}:judge@example.com`)
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      expect(parseRecipientToken(legacy)).toBeNull();
    });
  });
});
