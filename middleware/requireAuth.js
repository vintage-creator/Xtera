// middleware/requireAuth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User'); 

module.exports = async function requireAuth(req, res, next) {
  let token = req.cookies?.auth;

  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findOne({ walletAddress: payload.address });
    if (!user || !user.person) {
      return res.status(401).json({ error: 'User not found or missing person link' });
    }

    req.user = {
      address: payload.address,
      twoFA: payload.twoFA,
      person: user.person,
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
