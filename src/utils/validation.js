// PPL Season 7 — validation.js — upgraded
const { z } = require('zod');

const positionEnum = z.enum([
  'GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST',
  'BAT', 'BOWL', 'AR', 'WK',
]);

const playerIdSchema = z.object({ playerId: z.coerce.number().int().positive() });
const placeBidSchema = z.object({
  teamId: z.string().min(1),
  amount: z.coerce.number().positive(),
});
const teamIdSchema = z.object({ teamId: z.string().min(1) });
const playerFieldsSchema = z.object({
  name: z.string().min(1).max(200),
  position: positionEnum.optional().default('ST'),
  rating: z.coerce.number().int().min(1).max(99).optional().default(75),
  basePrice: z.coerce.number().positive(),
  photo: z.string().optional().default(''),
});
const teamFieldsSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(100),
  budget: z.coerce.number().int().positive().max(10000),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().default('#e63946'),
  logo: z.string().optional().default(''),
});
const playerEditSchema = playerFieldsSchema.extend({
  id: z.coerce.number().int().positive(),
});

function validate(schema, data) {
  const result = schema.safeParse(data);
  if (result.success) return { ok: true, data: result.data };
  return {
    ok: false,
    error: result.error.errors.map((e) => e.message).join('; '),
  };
}

module.exports = {
  playerIdSchema,
  placeBidSchema,
  teamIdSchema,
  playerFieldsSchema,
  teamFieldsSchema,
  playerEditSchema,
  validate,
};
