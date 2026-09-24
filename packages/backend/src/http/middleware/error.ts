import type { ErrorRequestHandler, RequestHandler } from 'express'
import { isAPIError } from 'better-auth/api'
import multer from 'multer'
import { AppError, ErrorCode, errors } from '../../lib/errors.js'
import type { Logger } from '../../lib/logger.js'

/** Better Auth error codes → our public error model. */
const AUTH_ERROR_MAP: Record<string, () => AppError> = {
  INVALID_EMAIL_OR_PASSWORD: errors.invalidCredentials,
  INVALID_PASSWORD: errors.invalidCredentials,
  CREDENTIAL_ACCOUNT_NOT_FOUND: errors.invalidCredentials,
  EMAIL_NOT_VERIFIED: errors.emailNotVerified,
  USER_ALREADY_EXISTS: errors.emailTaken,
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: errors.emailTaken,
}

function codeForStatus(status: number): ErrorCode {
  if (status === 401) return ErrorCode.UNAUTHORIZED
  if (status === 403) return ErrorCode.FORBIDDEN
  if (status === 404) return ErrorCode.NOT_FOUND
  if (status === 429) return ErrorCode.RATE_LIMITED
  if (status >= 500) return ErrorCode.INTERNAL_ERROR
  return ErrorCode.BAD_REQUEST
}

/** Convert anything thrown by a handler into an AppError. */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err

  if (isAPIError(err)) {
    const body = (err.body ?? {}) as { code?: string; message?: string }
    const mapped = body.code ? AUTH_ERROR_MAP[body.code] : undefined
    if (mapped) return mapped()
    const status = err.statusCode ?? 400
    return new AppError(
      status,
      codeForStatus(status),
      body.message ?? err.message ?? 'Authentication error',
      body.code ? { auth_code: body.code } : undefined,
      { cause: err },
    )
  }

  if (err instanceof multer.MulterError) {
    return err.code === 'LIMIT_FILE_SIZE'
      ? new AppError(413, ErrorCode.PAYLOAD_TOO_LARGE, 'File is too large')
      : errors.badRequest(`Upload error: ${err.message}`)
  }

  // MySQL constraint violations caused by client input.
  const errno = (err as { errno?: number } | null)?.errno
  if (errno === 1062) return errors.conflict('A record with the same unique value already exists')
  if (errno === 1452) return errors.badRequest('A referenced record (e.g. author or category) does not exist')
  if (errno === 1451) return errors.conflict('This record is still referenced by other records')

  // body-parser errors carry a `type`.
  const type = (err as { type?: string } | null)?.type
  if (type === 'entity.parse.failed') return errors.badRequest('Malformed JSON body')
  if (type === 'entity.too.large') return new AppError(413, ErrorCode.PAYLOAD_TOO_LARGE, 'Request body is too large')

  return new AppError(500, ErrorCode.INTERNAL_ERROR, 'Internal server error', undefined, { cause: err })
}

export function errorHandler(logger: Logger, options: { exposeInternalErrors: boolean }): ErrorRequestHandler {
  return (err, req, res, next) => {
    if (res.headersSent) return next(err)
    const appError = toAppError(err)
    const log: Logger = (req as { log?: Logger }).log ?? logger
    if (appError.isServerError) {
      log.error({ err: appError.cause ?? err, code: appError.code }, appError.message)
    } else {
      log.warn({ code: appError.code, status: appError.status, details: appError.details }, appError.message)
    }
    // Internal error details help while developing but must not leak in production.
    let message = appError.message
    if (appError.code === ErrorCode.INTERNAL_ERROR && options.exposeInternalErrors && appError.cause instanceof Error) {
      message = `Internal server error: ${appError.cause.message}`
    }
    res.status(appError.status).json({
      status: 'error',
      code: appError.code,
      message,
      ...(appError.details !== undefined ? { details: appError.details } : {}),
      request_id: req.id,
    })
  }
}

export const notFoundHandler: RequestHandler = (req) => {
  throw errors.notFound(`Route ${req.method} ${req.path}`)
}
