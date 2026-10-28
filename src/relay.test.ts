import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseTurn, readTurn, saveTurn, turnSource } from './live/relay';

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('the relay (TURN) settings', () => {
  it('accepts turn: and turns: addresses with a user name and password, one per line or separated by commas', () => {
    expect(parseTurn('turns:relay.example.com:443?transport=tcp', ' me ', ' secret ')).toEqual({ urls: ['turns:relay.example.com:443?transport=tcp'], username: 'me', credential: 'secret' });
    expect(parseTurn('turn:a.example.com:3478\nturns:a.example.com:443?transport=tcp, turn:b.example.com', 'u', 'p')?.urls).toHaveLength(3);
  });

  it('refuses anything else: no address, a web address, a missing user name or password, or far too many', () => {
    expect(parseTurn('', 'u', 'p')).toBeNull();
    expect(parseTurn('https://example.com', 'u', 'p')).toBeNull();
    expect(parseTurn('stun:stun.example.com:3478', 'u', 'p')).toBeNull();
    expect(parseTurn('turn:a.example.com', '', 'p')).toBeNull();
    expect(parseTurn('turn:a.example.com', 'u', '')).toBeNull();
    expect(parseTurn(Array.from({ length: 9 }, (_, i) => `turn:h${i}.example.com`).join(' '), 'u', 'p')).toBeNull();
    expect(parseTurn('turn:a.example.com', 'u', 'x'.repeat(513))).toBeNull();
  });

  it('is kept in this browser, read back, and forgotten', () => {
    expect(readTurn()).toBeNull();
    expect(turnSource()).toBeNull();
    const cfg = parseTurn('turns:relay.example.com:443', 'me', 'secret')!;
    expect(saveTurn(cfg)).toBe(true);
    expect(readTurn()).toEqual(cfg);
    expect(turnSource()).toBe('typed');
    expect(saveTurn(null)).toBe(true);
    expect(readTurn()).toBeNull();
  });

  it('ignores damaged saved text, and a browser that blocks storage', () => {
    store.set('perfect-home:turn', '{not json');
    expect(readTurn()).toBeNull();
    store.set('perfect-home:turn', JSON.stringify({ urls: ['https://nope'], username: 'u', credential: 'p' }));
    expect(readTurn()).toBeNull();
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    });
    expect(readTurn()).toBeNull();
    expect(saveTurn(parseTurn('turn:a.example.com', 'u', 'p'))).toBe(false);
  });
});
