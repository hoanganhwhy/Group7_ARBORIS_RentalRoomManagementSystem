import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });

const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required when NODE_ENV=production');
}

// The fallback only exists so the project runs out of the box on a dev machine.
export const JWT_SECRET = process.env.JWT_SECRET || 'arboris-local-development-secret';

const configuredOrigins = String(process.env.CORS_ORIGINS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

// Requests without an Origin header (SePay webhook, curl, same-origin GET) are not
// subject to CORS. Browser origins must be listed, or be localhost during development.
export const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (configuredOrigins.includes(origin)) return true;
  return !isProduction && LOCAL_ORIGIN.test(origin);
};

export const corsOptions = {
  origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
  credentials: true,
};
