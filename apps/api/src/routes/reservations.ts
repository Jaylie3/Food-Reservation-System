import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { pool } from '../lib/db.js';
import { AppError } from '../lib/errors.js';
import { acquireSlotLock, releaseSlotLock } from '../lib/slotLock.js';
import {
  getCachedIdempotentResponse,
  setCachedIdempotentResponse
} from '../lib/idempotency.js';
import type { ReservationCreateResponse } from '../types/api.js';

const reservationBodySchema = z.object({
  restaurant_id: z.string().uuid(),
  slot_id: z.string().uuid(),
  party_size: z.number().int().min(1).max(20),
  occasion: z.string().max(80).optional(),
  special_requests: z.string().max(280).optional(),
  dietary_notes: z.array(z.string().max(64)).max(20).optional(),
  high_chair_needed: z.boolean().optional(),
  table_ids: z.array(z.string().uuid()).max(4).optional(),
  promo_code: z.string().max(64).optional(),
  booking_source: z.string().max(32).optional(),
  guest_id: z.string().uuid().optional()
});

export const reservationRoutes: FastifyPluginAsync = async (app) => {
  app.post('/reservations', async (request, reply) => {
    const idempotencyKey = request.headers['idempotency-key'];
    if (!idempotencyKey || Array.isArray(idempotencyKey)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Idempotency-Key header is required');
    }

    const cachedResponse = await getCachedIdempotentResponse<ReservationCreateResponse>(idempotencyKey);
    if (cachedResponse) {
      return reply.code(200).send(cachedResponse);
    }

    const body = reservationBodySchema.parse(request.body);

    const slotLock = await acquireSlotLock(body.slot_id, 8);
    if (!slotLock) {
      throw new AppError(409, 'SLOT_UNAVAILABLE', 'This time slot is currently being booked. Try again.');
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const updateSlot = await client.query(
        `
        UPDATE time_slots
        SET reserved_seats = reserved_seats + $2
        WHERE id = $1
          AND restaurant_id = $3
          AND reserved_seats + $2 <= total_seats
          AND is_blocked = false
        RETURNING id, slot_date, slot_time
        `,
        [body.slot_id, body.party_size, body.restaurant_id]
      );

      if (updateSlot.rowCount === 0) {
        throw new AppError(
          409,
          'DOUBLE_BOOKING_PREVENTED',
          'This time slot no longer has availability for your party size.'
        );
      }

      const insertReservation = await client.query(
        `
        INSERT INTO reservations (
          guest_id,
          restaurant_id,
          slot_id,
          table_ids,
          party_size,
          status,
          occasion,
          special_requests,
          dietary_notes,
          high_chair_needed,
          promo_code,
          booking_source,
          deposit_required,
          deposit_amount
        )
        VALUES (
          $1, $2, $3, $4, $5,
          'confirmed',
          $6, $7, $8, $9, $10, $11,
          false,
          null
        )
        RETURNING id, confirmation_code, status
        `,
        [
          body.guest_id ?? null,
          body.restaurant_id,
          body.slot_id,
          body.table_ids ?? null,
          body.party_size,
          body.occasion ?? null,
          body.special_requests ?? null,
          body.dietary_notes ?? null,
          body.high_chair_needed ?? false,
          body.promo_code ?? null,
          body.booking_source ?? 'direct'
        ]
      );

      const reservation = insertReservation.rows[0] as {
        id: string;
        confirmation_code: string;
        status: 'pending' | 'confirmed';
      };

      await client.query(
        `
        INSERT INTO reservation_audit_log (
          reservation_id,
          actor_id,
          actor_role,
          action,
          old_status,
          new_status,
          metadata
        )
        VALUES ($1, $2, 'guest', 'reservation_created', null, $3, $4)
        `,
        [reservation.id, body.guest_id ?? null, reservation.status, JSON.stringify({
          party_size: body.party_size,
          slot_id: body.slot_id,
          restaurant_id: body.restaurant_id
        })]
      );

      await client.query('COMMIT');

      const responsePayload: ReservationCreateResponse = {
        reservation_id: reservation.id,
        confirmation_code: reservation.confirmation_code,
        status: reservation.status,
        deposit_required: false,
        deposit_amount: null,
        stripe_payment_intent_client_secret: null
      };

      await setCachedIdempotentResponse(idempotencyKey, responsePayload);

      return reply.code(201).send(responsePayload);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
      await releaseSlotLock(slotLock);
    }
  });
};
