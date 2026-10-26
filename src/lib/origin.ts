type OriginConfig = Partial<Pick<NodeJS.ProcessEnv, 'APP_ORIGIN' | 'APP_PREVIEW_ORIGINS' | 'NODE_ENV' | 'VERCEL_ENV'>>;

function parseOrigin(value: string, requireHttps: boolean): string | null {
  try {
    const parsed = new URL(value);
    if ((parsed.protocol !== 'https:' && parsed.protocol !== 'http:') || parsed.origin !== value) return null;
    if (parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) return null;
    if (requireHttps && parsed.protocol !== 'https:') return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

export function isAllowedRequestOrigin(origin: string | null, config: OriginConfig): boolean {
  if (!origin) return false;
  const deployed = config.VERCEL_ENV === 'production' || config.VERCEL_ENV === 'preview';
  const requireHttps = config.NODE_ENV === 'production' || deployed;
  const requestOrigin = parseOrigin(origin, requireHttps);
  if (!requestOrigin) return false;

  const configuredOrigin = config.APP_ORIGIN ?? (requireHttps ? '' : 'http://localhost:3000');
  const allowed = new Set<string>();
  const primary = parseOrigin(configuredOrigin, requireHttps);
  if (primary) allowed.add(primary);

  // Additional origins are only considered by Vercel Preview deployments, and each
  // must be explicitly configured. There is no suffix or wildcard matching.
  if (config.VERCEL_ENV === 'preview' && config.APP_PREVIEW_ORIGINS) {
    for (const candidate of config.APP_PREVIEW_ORIGINS.split(',')) {
      const normalized = parseOrigin(candidate.trim(), true);
      if (normalized) allowed.add(normalized);
    }
  }

  return allowed.has(requestOrigin);
}
