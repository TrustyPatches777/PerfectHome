/**
 * An optional TURN relay for live sessions. Two browsers normally connect directly; on some networks (schools, companies, mobile hotspots) that is
 * blocked, and a relay server carries the traffic instead. The app has none of its own: the credentials come from a hosted TURN service and are
 * either built into the site (VITE_TURN_* at build time) or typed into the Live dialog (kept in this browser only, never in a link).
 */

export interface TurnConfig {
  urls: string[];
  username: string;
  credential: string;
}

const KEY = 'perfect-home:turn';

/** Check what was typed: one or more `turn:` / `turns:` addresses, a user name and a password. Null when something is missing or wrong. */
export function parseTurn(urlsText: string, username: string, credential: string): TurnConfig | null {
  const urls = urlsText
    .split(/[\s,]+/)
    .map((u) => u.trim())
    .filter(Boolean);
  if (!urls.length || urls.length > 8 || !urls.every((u) => /^turns?:[^\s]{3,200}$/i.test(u))) return null;
  const user = username.trim();
  const pass = credential.trim();
  if (!user || !pass || user.length > 512 || pass.length > 512) return null;
  return { urls, username: user, credential: pass };
}

const fromEnv = (): TurnConfig | null => {
  const env = import.meta.env as Record<string, string | undefined>;
  return parseTurn(env.VITE_TURN_URLS ?? '', env.VITE_TURN_USERNAME ?? '', env.VITE_TURN_CREDENTIAL ?? '');
};

/** The relay this browser uses: the one typed into the Live dialog, otherwise the one built into the site, otherwise none. */
export function readTurn(): TurnConfig | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const j = JSON.parse(raw) as Partial<TurnConfig>;
      const own = parseTurn((j.urls ?? []).join(' '), j.username ?? '', j.credential ?? '');
      if (own) return own;
    }
  } catch {
    /* storage blocked or the saved text is damaged: use the built-in one */
  }
  return fromEnv();
}

/** Where the current relay comes from, for the dialog. */
export const turnSource = (): 'typed' | 'site' | null => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const j = JSON.parse(raw) as Partial<TurnConfig>;
      if (parseTurn((j.urls ?? []).join(' '), j.username ?? '', j.credential ?? '')) return 'typed';
    }
  } catch {
    /* see readTurn */
  }
  return fromEnv() ? 'site' : null;
};

/** Keep (or with null, forget) the relay typed into the dialog. Returns false when the browser would not store it. */
export function saveTurn(cfg: TurnConfig | null): boolean {
  try {
    if (cfg) localStorage.setItem(KEY, JSON.stringify(cfg));
    else localStorage.removeItem(KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * Try the relay: ask the browser for a connection route that has to go through it. If the address and the credentials are right the relay hands out
 * an address of its own within a few seconds.
 */
export async function testTurn(cfg: TurnConfig, timeoutMs = 10_000): Promise<{ ok: boolean; reason?: string }> {
  if (typeof RTCPeerConnection === 'undefined') return { ok: false, reason: 'This browser has no direct-connection support.' };
  const pc = new RTCPeerConnection({ iceServers: [{ urls: cfg.urls, username: cfg.username, credential: cfg.credential }], iceTransportPolicy: 'relay' });
  try {
    let failure = '';
    const found = new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), timeoutMs);
      pc.onicecandidate = (e) => {
        if (e.candidate?.candidate.includes(' typ relay')) {
          clearTimeout(timer);
          resolve(true);
        }
      };
      pc.onicecandidateerror = (e) => {
        const ev = e as RTCPeerConnectionIceErrorEvent;
        failure = `${ev.errorCode} ${ev.errorText}`.trim();
      };
      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === 'complete') {
          clearTimeout(timer);
          resolve(false);
        }
      };
    });
    pc.createDataChannel('test');
    await pc.setLocalDescription(await pc.createOffer());
    const ok = await found;
    return ok ? { ok } : { ok, reason: failure ? `The relay answered: ${failure}` : 'The relay did not answer. Check the address, the user name and the password.' };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  } finally {
    pc.close();
  }
}
