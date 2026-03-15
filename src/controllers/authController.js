const { verifyAdminPassword } = require('../models/Config');
const { signAdminToken } = require('../services/authService');

async function verifyPassword(req, res) {
  const password = req.body && (req.body.password != null ? req.body.password : req.body);
  try {
    const ok = !!password && (await verifyAdminPassword(String(password)));
    return res.json({ ok: !!ok });
  } catch (err) {
    return res.json({ ok: false });
  }
}

async function login(req, res) {
  const password = req.body && (req.body.password != null ? req.body.password : req.body);
  const ok = !!password && (await verifyAdminPassword(String(password)));
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const token = signAdminToken();
  return res.json({ token });
}

module.exports = {
  verifyPassword,
  login,
};
