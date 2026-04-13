export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    request_id: string;
  };
}

export interface ReservationCreateResponse {
  reservation_id: string;
  confirmation_code: string;
  status: 'pending' | 'confirmed';
  deposit_required: boolean;
  deposit_amount: number | null;
  stripe_payment_intent_client_secret: string | null;
}
