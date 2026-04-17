/**
 * Authentication Middleware
 * JWT verification and token generation
 */
const jwt = require('jsonwebtoken');
const { User } = require('../models');

/**
 * Authenticate user via JWT token
 */
const authenticate = async (req, res, next) => {
  try {
    const token =
      req.headers.authorization?.replace('Bearer ', '') ||
      req.cookies?.token;

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

/**
 * Optional authentication — sets req.user if token present, but doesn't block
 */
const optionalAuth = async (req, res, next) => {
  try {
    const token =
      req.headers.authorization?.replace('Bearer ', '') ||
      req.cookies?.token;
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findByPk(decoded.id);
    }
  } catch {
    // Ignore — user stays unauthenticated
  }
  next();
};

/**
 * Generate JWT token for a user
 */
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

module.exports = { authenticate, optionalAuth, generateToken };
