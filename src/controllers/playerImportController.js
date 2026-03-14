// PPL Season 7 — playerImportController.js — upgraded
const { parse } = require('csv-parse/sync');
const { addPlayer } = require('../models/Player');
const { validate, playerFieldsSchema } = require('../utils/validation');

const POSITION_ALIASES = {
  bat: 'BAT',
  bowl: 'BOWL',
  ar: 'AR',
  wk: 'WK',
  gk: 'GK',
  cb: 'CB',
  lb: 'LB',
  rb: 'RB',
  cdm: 'CDM',
  cm: 'CM',
  cam: 'CAM',
  lw: 'LW',
  rw: 'RW',
  st: 'ST',
};

function parsePosition(val) {
  if (!val || typeof val !== 'string') return 'ST';
  const v = val.trim().toUpperCase();
  const alias = POSITION_ALIASES[val.trim().toLowerCase()];
  if (alias) return alias;
  if (['BAT', 'BOWL', 'AR', 'WK', 'GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST'].includes(v)) return v;
  return v || 'ST';
}

async function importPlayers(req, res) {
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ error: 'No CSV file uploaded' });
  }

  const content = req.file.buffer.toString('utf8');
  let rows;
  try {
    rows = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });
  } catch (err) {
    return res.status(400).json({ error: 'Invalid CSV format', details: err.message });
  }

  const result = { imported: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const name = (row.name || row.Name || row.NAME || '').trim();
    const category = (row.category || row.position || row.Position || row.Category || '').trim();
    const basePrice = parseFloat(row.basePrice || row.base_price || row.baseprice || row.BasePrice || 0);
    const age = parseInt(row.age || row.Age || 0, 10) || undefined;

    if (!name) {
      result.skipped++;
      result.errors.push({ row: i + 2, msg: 'Missing name' });
      continue;
    }

    if (!basePrice || isNaN(basePrice) || basePrice <= 0) {
      result.skipped++;
      result.errors.push({ row: i + 2, msg: 'Invalid or missing base price' });
      continue;
    }

    const position = parsePosition(category);
    const validated = validate(playerFieldsSchema, {
      name,
      position,
      basePrice,
      rating: 75,
      photo: '',
    });

    if (!validated.ok) {
      result.skipped++;
      result.errors.push({ row: i + 2, msg: validated.error });
      continue;
    }

    try {
      await addPlayer({
        name: validated.data.name,
        position: validated.data.position,
        basePrice: validated.data.basePrice,
        rating: validated.data.rating,
        photo: validated.data.photo,
      });
      result.imported++;
    } catch (err) {
      result.skipped++;
      result.errors.push({ row: i + 2, msg: err.message || 'Failed to add player' });
    }
  }

  return res.status(200).json(result);
}

module.exports = { importPlayers };
