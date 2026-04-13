export type ApiErrorCode =
  | 'SLOT_UNAVAILABLE'
  | 'DOUBLE_BOOKING_PREVENTED'
  | 'DEPOSIT_REQUIRED'
  | 'PROMO_CODE_INVALID'
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'RESERVATION_NOT_FOUND'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ApiErrorCode;
  public readonly details?: Record<string, unknown>;

  constructor(
    statusCode: number,
    code: ApiErrorCode,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const toErrorPayload = (
  error: AppError,
  requestId: string
): { error: { code: string; message: string; details?: Record<string, unknown>; request_id: string } } => ({
  error: {
    code: error.code,
    message: error.message,
    details: error.details,
    request_id: requestId
  }
});
