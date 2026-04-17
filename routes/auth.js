/**
 * Authentication Routes
 * Register, Login, Profile, Google OAuth
 */
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const passport = require('passport');
const { User, Category } = require('../models');
const { authenticate, generateToken } = require('../middleware/auth');
const { registerValidation, loginValidation } = require('../middleware/validation');
const { authLimiter } = require('../middleware/rateLimiter');

// Default categories seeded on registration
const DEFAULT_CATEGORIES = [
  { name: 'Salary', type: 'income', icon: '💰', color: '#10b981' },
  { name: 'Freelance', type: 'income', icon: '💻', color: '#6366f1' },
  { name: 'Investment Returns', type: 'income', icon: '📈', color: '#f59e0b' },
  { name: 'Other Income', type: 'income', icon: '💵', color: '#8b5cf6' },
  { name: 'Food & Dining', type: 'expense', icon: '🍔', color: '#ef4444' },
  { name: 'Transportation', type: 'expense', icon: '🚗', color: '#f97316' },
  { name: 'Housing', type: 'expense', icon: '🏠', color: '#06b6d4' },
  { name: 'Utilities', type: 'expense', icon: '⚡', color: '#eab308' },
  { name: 'Entertainment', type: 'expense', icon: '🎬', color: '#ec4899' },
  { name: 'Shopping', type: 'expense', icon: '🛍️', color: '#a855f7' },
  { name: 'Healthcare', type: 'expense', icon: '🏥', color: '#14b8a6' },
  { name: 'Education', type: 'expense', icon: '📚', color: '#3b82f6' },
  { name: 'Subscriptions', type: 'expense', icon: '📱', color: '#f43f5e' },
  { name: 'Travel', type: 'expense', icon: '✈️', color: '#0ea5e9' },
];

/** POST /api/auth/register */
router.post('/register', authLimiter, registerValidation, async (req, res, next) => {
  try {
    const { name, email, password, default_currency } = req.body;

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const user = await User.create({
      name,
      email,
      password_hash: password, // hashed by beforeCreate hook
      default_currency: default_currency || 'USD',
    });

    // Seed default categories
    await Category.bulkCreate(
      DEFAULT_CATEGORIES.map((c) => ({ ...c, user_id: user.id }))
    );

    const token = generateToken(user);
    res.status(201).json({ token, user });
  } catch (err) {
    next(err);
  }
});

/** POST /api/auth/login */
router.post('/login', authLimiter, loginValidation, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });

    if (!user || !(await user.validatePassword(password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(user);
    res.json({ token, user });
  } catch (err) {
    next(err);
  }
});

/** GET /api/auth/me — Get current user profile */
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

/** PUT /api/auth/profile — Update profile */
router.put('/profile', authenticate, async (req, res, next) => {
  try {
    const { name, default_currency, notification_preferences } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (default_currency) updates.default_currency = default_currency;
    if (notification_preferences) updates.notification_preferences = notification_preferences;

    await req.user.update(updates);
    res.json({ user: req.user });
  } catch (err) {
    next(err);
  }
});

/** PUT /api/auth/password — Change password */
router.put('/password', authenticate, async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Both current and new password required' });
    }
    if (new_password.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    const valid = await req.user.validatePassword(current_password);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    req.user.password_hash = new_password; // hashed by beforeUpdate hook
    await req.user.save();
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
});

/** GET /api/auth/google — Start Google OAuth */
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

/** GET /api/auth/google/callback */
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/?error=oauth_failed' }),
  async (req, res) => {
    try {
      const token = generateToken(req.user);
      // Check if user has categories, seed if new
      const catCount = await Category.count({ where: { user_id: req.user.id } });
      if (catCount === 0) {
        await Category.bulkCreate(
          DEFAULT_CATEGORIES.map((c) => ({ ...c, user_id: req.user.id }))
        );
      }
      res.redirect(`/?token=${token}`);
    } catch (err) {
      res.redirect('/?error=oauth_failed');
    }
  }
);

/** POST /api/auth/refresh — Refresh token */
router.post('/refresh', authenticate, (req, res) => {
  const token = generateToken(req.user);
  res.json({ token });
});

module.exports = router;
