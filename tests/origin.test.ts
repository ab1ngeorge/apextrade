import { describe, expect, it } from 'vitest';
import { isAllowedRequestOrigin } from '../src/lib/origin';

describe('request origin validation', () => {
  it('allows the explicitly configured production origin', () => {
    expect(isAllowedRequestOrigin('https://apextrade-alpha.vercel.app', {
      NODE_ENV: 'production', VERCEL_ENV: 'production', APP_ORIGIN: 'https://apextrade-alpha.vercel.app',
    })).toBe(true);
  });

  it('allows the local development origin by default', () => {
    expect(isAllowedRequestOrigin('http://localhost:3000', { NODE_ENV: 'development' })).toBe(true);
  });

  it('rejects a missing origin', () => {
    expect(isAllowedRequestOrigin(null, { NODE_ENV: 'production', APP_ORIGIN: 'https://apextrade-alpha.vercel.app' })).toBe(false);
  });

  it('rejects malformed and non-origin URL values', () => {
    const config = { NODE_ENV: 'production', APP_ORIGIN: 'https://apextrade-alpha.vercel.app' } as const;
    expect(isAllowedRequestOrigin('not a url', config)).toBe(false);
    expect(isAllowedRequestOrigin('https://apextrade-alpha.vercel.app/path', config)).toBe(false);
  });

  it('rejects untrusted origins and insecure production origins', () => {
    const config = { NODE_ENV: 'production', APP_ORIGIN: 'https://apextrade-alpha.vercel.app' } as const;
    expect(isAllowedRequestOrigin('https://attacker.example', config)).toBe(false);
    expect(isAllowedRequestOrigin('https://apextrade-alpha.vercel.app.evil.example', config)).toBe(false);
    expect(isAllowedRequestOrigin('http://apextrade-alpha.vercel.app', config)).toBe(false);
  });

  it('allows only explicitly listed origins in Vercel Preview', () => {
    const config = {
      NODE_ENV: 'production', VERCEL_ENV: 'preview', APP_ORIGIN: 'https://apextrade-alpha.vercel.app',
      APP_PREVIEW_ORIGINS: 'https://preview-apextrade.example, https://apextrade-git-fix-origin-team.vercel.app',
    } as const;
    expect(isAllowedRequestOrigin('https://preview-apextrade.example', config)).toBe(true);
    expect(isAllowedRequestOrigin('https://apextrade-git-fix-origin-team.vercel.app', config)).toBe(true);
    expect(isAllowedRequestOrigin('https://apextrade-unknown.vercel.app', config)).toBe(false);
  });

  it('does not enable the Preview allowlist in Production', () => {
    expect(isAllowedRequestOrigin('https://preview-apextrade.example', {
      NODE_ENV: 'production', VERCEL_ENV: 'production', APP_ORIGIN: 'https://apextrade-alpha.vercel.app',
      APP_PREVIEW_ORIGINS: 'https://preview-apextrade.example',
    })).toBe(false);
  });
});
