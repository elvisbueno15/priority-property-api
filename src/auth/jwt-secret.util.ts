/**
 * Single source of truth for the JWT signing secret.
 *
 * In production the secret MUST come from the environment. If it's missing we
 * throw at boot instead of silently falling back to a public, well-known value
 * (which would let anyone forge valid session tokens). Locally we allow a dev
 * fallback so `npm run start:dev` works without extra setup.
 */
function resolveJwtSecret(): string {
  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv && fromEnv.length >= 16) return fromEnv;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'JWT_SECRET is not set (or too short) in production. Refusing to start with an insecure signing key.',
    );
  }
  return 'dev-secret-change-me';
}

export const JWT_SECRET = resolveJwtSecret();
