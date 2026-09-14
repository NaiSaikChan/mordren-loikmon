import { createRequire } from 'node:module'
import pino from 'pino'
import { config } from '../config.js'

// Use pino-pretty in dev ONLY if it's actually installed (it's an optional
// devDependency). Falls back to plain JSON logging otherwise — this keeps the
// logger working in test/CI environments without the pretty transport.
function prettyTransport() {
  if (config.isProd || process.env.NODE_ENV === 'test') return undefined
  try {
    createRequire(import.meta.url).resolve('pino-pretty')
    return {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
    }
  } catch {
    return undefined
  }
}

export const logger = pino({
  level: config.logLevel,
  transport: prettyTransport(),
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.password_hash',
      '*.secretKey',
      '*.privateKey',
      '*.sharedSecret',
    ],
    censor: '[REDACTED]',
  },
})

export type Logger = typeof logger
