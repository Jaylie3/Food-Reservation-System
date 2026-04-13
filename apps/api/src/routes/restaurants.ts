import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { pool } from '../lib/db.js';
import { AppError } from '../lib/errors.js';

const listQuerySchema = z.object({
  city: z.string().optional(),
  cuisine: z.union([z.string(), z.array(z.string())]).optional(),
  available_only: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional()
});

const availabilityQuerySchema = z.object({
  date: z.string().min(10),
  party_size: z.coerce.number().int().min(1).max(20)
});

export const restaurantRoutes: FastifyPluginAsync = async (app) => {
  app.get('/restaurants', async (request) => {
    const query = listQuerySchema.parse(request.query);

    const values: unknown[] = [];
    const where: string[] = ['r.is_active = true'];

    if (query.city) {
      values.push(query.city);
      where.push(`r.city ILIKE $${values.length}`);
    }

    if (query.cuisine) {
      const cuisines = Array.isArray(query.cuisine) ? query.cuisine : [query.cuisine];
      values.push(cuisines);
      where.push(`r.cuisines && $${values.length}::text[]`);
    }

    values.push(query.limit);

    const sql = `
      SELECT
        r.id,
        r.slug,
        r.name,
        r.short_bio,
        r.cuisines,
        r.price_tier,
        r.cover_image_url,
        r.city,
        r.country,
        r.avg_rating,
        r.review_count
      FROM restaurants r
      WHERE ${where.join(' AND ')}
      ORDER BY r.is_featured DESC, r.avg_rating DESC, r.review_count DESC
      LIMIT $${values.length}
    `;

    const result = await pool.query(sql, values);

    return {
      data: result.rows,
      next_cursor: null,
      has_more: false
    };
  });

  app.get('/restaurants/:id/availability', async (request) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const query = availabilityQuerySchema.parse(request.query);

    const result = await pool.query(
      `
      SELECT
        id,
        slot_date,
        slot_time,
        duration_mins,
        total_seats,
        reserved_seats,
        (total_seats - reserved_seats) AS available_seats,
        is_blocked
      FROM time_slots
      WHERE restaurant_id = $1
        AND slot_date = $2::date
        AND is_blocked = false
        AND (total_seats - reserved_seats) >= $3
      ORDER BY slot_time ASC
      `,
      [params.id, query.date, query.party_size]
    );

    return {
      data: result.rows,
      next_cursor: null,
      has_more: false
    };
  });

  app.get('/restaurants/:id', async (request) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);

    const result = await pool.query(
      `
      SELECT *
      FROM restaurants
      WHERE id = $1 AND is_active = true
      LIMIT 1
      `,
      [params.id]
    );

    if (result.rowCount === 0) {
      throw new AppError(404, 'RESERVATION_NOT_FOUND', 'Restaurant not found');
    }

    return result.rows[0];
  });
};
