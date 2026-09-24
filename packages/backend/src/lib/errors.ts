/**
 * Application error model. Every error that reaches a client carries a stable
 * machine-readable `code` (clients branch on it — e.g. SUBSCRIPTION_REQUIRED
 * opens the paywall) plus a human-readable message.
 */

export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  FORBIDDEN: 'FORBIDDEN',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  OWNERSHIP_REQUIRED: 'OWNERSHIP_REQUIRED',
  ROLE_PROTECTED: 'ROLE_PROTECTED',
  INVALID_TRANSITION: 'INVALID_TRANSITION',
  COUPON_INVALID: 'COUPON_INVALID',
  COUPON_EXPIRED: 'COUPON_EXPIRED',
  COUPON_EXHAUSTED: 'COUPON_EXHAUSTED',
  COUPON_NOT_APPLICABLE: 'COUPON_NOT_APPLICABLE',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  RATE_LIMITED: 'RATE_LIMITED',
  SUBSCRIPTION_REQUIRED: 'SUBSCRIPTION_REQUIRED',
  LOGIN_REQUIRED: 'LOGIN_REQUIRED',
  PURCHASE_INVALID: 'PURCHASE_INVALID',
  PURCHASE_ALREADY_LINKED: 'PURCHASE_ALREADY_LINKED',
  UNKNOWN_PRODUCT: 'UNKNOWN_PRODUCT',
  STORE_NOT_CONFIGURED: 'STORE_NOT_CONFIGURED',
  STORE_UNAVAILABLE: 'STORE_UNAVAILABLE',
  WEBHOOK_UNAUTHORIZED: 'WEBHOOK_UNAUTHORIZED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode]

export class AppError extends Error {
  override name = 'AppError'

  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
    options?: { cause?: unknown },
  ) {
    super(message, options)
  }

  /** 5xx errors are our fault and are logged at error level; 4xx are the caller's. */
  get isServerError(): boolean {
    return this.status >= 500
  }
}

export const errors = {
  validation: (details: unknown, message = 'Request validation failed') =>
    new AppError(400, ErrorCode.VALIDATION_ERROR, message, details),
  badRequest: (message: string, details?: unknown) => new AppError(400, ErrorCode.BAD_REQUEST, message, details),
  unauthorized: (message = 'Authentication required') => new AppError(401, ErrorCode.UNAUTHORIZED, message),
  invalidCredentials: () => new AppError(401, ErrorCode.INVALID_CREDENTIALS, 'Invalid email or password'),
  emailNotVerified: () =>
    new AppError(403, ErrorCode.EMAIL_NOT_VERIFIED, 'Please verify your email address before signing in'),
  emailTaken: () => new AppError(409, ErrorCode.EMAIL_TAKEN, 'An account with this email already exists'),
  forbidden: (message = 'You do not have permission to perform this action') =>
    new AppError(403, ErrorCode.FORBIDDEN, message),
  /** A named permission is missing; `details.required` tells the client which. */
  permissionDenied: (required: string | string[]) =>
    new AppError(403, ErrorCode.PERMISSION_DENIED, 'You do not have permission to perform this action', {
      required: Array.isArray(required) ? required : [required],
    }),
  /** The actor holds the permission but the row belongs to somebody else. */
  ownershipRequired: (resource = 'record') =>
    new AppError(403, ErrorCode.OWNERSHIP_REQUIRED, `You can only manage your own ${resource}`),
  roleProtected: (message = 'System roles cannot be modified') =>
    new AppError(409, ErrorCode.ROLE_PROTECTED, message),
  invalidTransition: (from: string, to: string) =>
    new AppError(409, ErrorCode.INVALID_TRANSITION, `Cannot move from "${from}" to "${to}"`, { from, to }),
  couponInvalid: (message = 'This coupon code is not valid') => new AppError(422, ErrorCode.COUPON_INVALID, message),
  couponExpired: () => new AppError(422, ErrorCode.COUPON_EXPIRED, 'This coupon is outside its validity period'),
  couponExhausted: () => new AppError(422, ErrorCode.COUPON_EXHAUSTED, 'This coupon has reached its redemption limit'),
  couponNotApplicable: (message = 'This coupon does not apply to the selected item') =>
    new AppError(422, ErrorCode.COUPON_NOT_APPLICABLE, message),
  notFound: (resource = 'Resource') => new AppError(404, ErrorCode.NOT_FOUND, `${resource} not found`),
  conflict: (message: string, details?: unknown) => new AppError(409, ErrorCode.CONFLICT, message, details),
  loginRequired: () => new AppError(401, ErrorCode.LOGIN_REQUIRED, 'Sign in to access this content'),
  subscriptionRequired: () =>
    new AppError(403, ErrorCode.SUBSCRIPTION_REQUIRED, 'An active subscription is required to access this content'),
  purchaseInvalid: (message: string, cause?: unknown) =>
    new AppError(422, ErrorCode.PURCHASE_INVALID, message, undefined, { cause }),
  purchaseAlreadyLinked: () =>
    new AppError(
      409,
      ErrorCode.PURCHASE_ALREADY_LINKED,
      'This store subscription is already linked to a different Loikmon account',
    ),
  unknownProduct: (productId: string) =>
    new AppError(422, ErrorCode.UNKNOWN_PRODUCT, `Product "${productId}" is not a Loikmon subscription plan`),
  storeNotConfigured: (store: string) =>
    new AppError(503, ErrorCode.STORE_NOT_CONFIGURED, `${store} billing is not configured on this server`),
  storeUnavailable: (store: string, cause?: unknown) =>
    new AppError(502, ErrorCode.STORE_UNAVAILABLE, `${store} could not be reached, please retry`, undefined, { cause }),
  webhookUnauthorized: (message = 'Webhook authentication failed') =>
    new AppError(401, ErrorCode.WEBHOOK_UNAUTHORIZED, message),
  serviceUnavailable: (message: string) => new AppError(503, ErrorCode.SERVICE_UNAVAILABLE, message),
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError
}
