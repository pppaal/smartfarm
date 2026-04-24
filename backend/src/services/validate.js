import { z } from 'zod';

export function validate(schema) {
  return (req, res, next) => {
    const r = schema.safeParse(req.body || {});
    if (!r.success) {
      const issue = r.error.issues[0];
      return res.status(400).json({ error: `${issue.path.join('.')}: ${issue.message}` });
    }
    req.body = r.data;
    next();
  };
}

const email = z.string().email();
const password = z.string().min(8, 'password must be at least 8 chars').max(128);

export const schemas = {
  register: z.object({
    email, password,
    name: z.string().min(1).max(50),
    terms: z.boolean(),
    privacy: z.boolean(),
    age_14: z.boolean(),
    marketing: z.boolean().optional(),
  }),
  login: z.object({
    email: z.string().min(1),
    password: z.string().min(1),
  }),
  changePassword: z.object({
    current_password: z.string().min(1),
    new_password: password,
  }),
  requestReset: z.object({ email }),
  resetPassword: z.object({
    token: z.string().min(10),
    new_password: password,
  }),
  createGreenhouse: z.object({
    name: z.string().min(1).max(50),
    location: z.string().max(100).optional(),
    crop: z.string().max(30).optional(),
    variety: z.string().max(30).optional(),
    planted_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    area_pyeong: z.number().positive().max(100000).optional(),
  }),
  createRule: z.object({
    name: z.string().min(1).max(50),
    metric: z.enum(['temperature', 'humidity', 'soil_moisture', 'co2', 'light']),
    operator: z.enum(['<', '>', '<=', '>=']),
    threshold: z.number(),
    action: z.enum(['irrigate', 'vent', 'heat', 'cool']),
    duration_sec: z.number().int().min(1).max(3600).optional(),
    cooldown_sec: z.number().int().min(0).max(86400).optional(),
  }),
  ingest: z.object({
    device_key: z.string().min(10),
    temperature: z.number().optional(),
    humidity: z.number().optional(),
    soil_moisture: z.number().optional(),
    co2: z.number().optional(),
    light: z.number().optional(),
  }),
  harvest: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    weight_kg: z.number().nonnegative(),
    grade: z.string().max(10).optional().nullable(),
    notes: z.string().max(500).optional().nullable(),
  }),
  sale: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    channel: z.string().max(30).optional().nullable(),
    weight_kg: z.number().nonnegative(),
    unit_price: z.number().int().nonnegative(),
    buyer: z.string().max(100).optional().nullable(),
  }),
  pushSubscribe: z.object({
    endpoint: z.string().url(),
    keys: z.object({ p256dh: z.string(), auth: z.string() }),
  }),
};
