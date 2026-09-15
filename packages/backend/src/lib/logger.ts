import pino, { type Logger } from 'pino'
import type { AppConfig } from '../config/env.js'

export type { Logger }

/**
 * Structured JSON logs in production (Docker collects stdout); pretty,
 * colourised logs in development. Secrets that commonly appear in request
 * logs are redacted.
 */
export function createLogger(config: Pick<AppConfig, 'logLevel' | 'isProduction' | 'isTest'>): Logger {
  const usePretty = !config.isProduction && !config.isTest
  return pino({
    level: config.logLevel,
    base: { service: 'loikmon-backend' },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-auth-token"]',
        'res.headers["set-cookie"]',
        '*.password',
        '*.new_password',
        '*.current_password',
        '*.purchase_token',
        '*.transaction_jws',
      ],
      censor: '[redacted]',
    },
    ...(usePretty
      ? { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l', ignore: 'pid,hostname,service' } } }
      : {}),
  })
}
