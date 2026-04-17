/**
 * Category Routes
 * CRUD operations for income/expense categories
 */
const express = require('express');
const router = express.Router();
const { Category, Transaction } = require('../models');
const { authenticate } = require('../middleware/auth');
const { categoryValidation, uuidParam } = require('../middleware/validation');

/** GET /api/categories */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const where = { user_id: req.user.id };
    if (req.query.type) where.type = req.query.type;

    const categories = await Category.findAll({ where, order: [['name', 'ASC']] });
    res.json({ categories });
  } catch (err) { next(err); }
});

/** POST /api/categories */
router.post('/', authenticate, categoryValidation, async (req, res, next) => {
  try {
    const { name, type, icon, color } = req.body;
    const category = await Category.create({
      user_id: req.user.id, name, type,
      icon: icon || '📁', color: color || '#6366f1',
    });
    res.status(201).json({ category });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'Category with this name and type already exists' });
    }
    next(err);
  }
});

/** PUT /api/categories/:id */
router.put('/:id', authenticate, uuidParam, async (req, res, next) => {
  try {
    const category = await Category.findOne({
      where: { id: req.params.id, user_id: req.user.id },
    });
    if (!category) return res.status(404).json({ error: 'Category not found' });

    const { name, icon, color } = req.body;
    if (name) category.name = name;
    if (icon) category.icon = icon;
    if (color) category.color = color;
    await category.save();

    res.json({ category });
  } catch (err) { next(err); }
});

/** DELETE /api/categories/:id */
router.delete('/:id', authenticate, uuidParam, async (req, res, next) => {
  try {
    const category = await Category.findOne({
      where: { id: req.params.id, user_id: req.user.id },
    });
    if (!category) return res.status(404).json({ error: 'Category not found' });

    // Count affected transactions
    const txCount = await Transaction.count({ where: { category_id: category.id } });

    // SET NULL on transactions (handled by association), then delete
    await category.destroy();

    res.json({
      message: 'Category deleted',
      affected_transactions: txCount,
      note: txCount > 0 ? `${txCount} transaction(s) moved to Uncategorized` : undefined,
    });
  } catch (err) { next(err); }
});

module.exports = router;
