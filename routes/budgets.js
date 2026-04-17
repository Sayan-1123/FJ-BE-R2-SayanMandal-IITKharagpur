/**
 * Budget Routes
 * CRUD + progress tracking for budget goals
 */
const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Budget, Category, Transaction } = require('../models');
const { authenticate } = require('../middleware/auth');
const { budgetValidation, uuidParam } = require('../middleware/validation');

/** GET /api/budgets — List all budgets with spending progress */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const budgets = await Budget.findAll({
      where: { user_id: req.user.id },
      include: [{ model: Category, as: 'category', attributes: ['id', 'name', 'icon', 'color'] }],
      order: [['created_at', 'DESC']],
    });

    // Calculate spending for each budget
    const now = new Date();
    const budgetsWithProgress = await Promise.all(
      budgets.map(async (budget) => {
        let periodStart;
        if (budget.period === 'monthly') {
          periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        } else if (budget.period === 'weekly') {
          periodStart = new Date(now);
          periodStart.setDate(now.getDate() - now.getDay());
        } else {
          periodStart = new Date(now.getFullYear(), 0, 1);
        }

        const spent = await Transaction.sum('converted_amount', {
          where: {
            user_id: req.user.id,
            type: 'expense',
            ...(budget.category_id ? { category_id: budget.category_id } : {}),
            date: { [Op.gte]: periodStart.toISOString().split('T')[0] },
          },
        }) || 0;

        return {
          ...budget.toJSON(),
          spent: parseFloat(spent).toFixed(2),
          percentage: Math.round((spent / parseFloat(budget.amount)) * 100),
          remaining: Math.max(0, parseFloat(budget.amount) - spent).toFixed(2),
        };
      })
    );

    res.json({ budgets: budgetsWithProgress });
  } catch (err) { next(err); }
});

/** POST /api/budgets */
router.post('/', authenticate, budgetValidation, async (req, res, next) => {
  try {
    const { amount, period, start_date, end_date, category_id, alert_threshold } = req.body;

    // Validate category
    if (category_id) {
      const cat = await Category.findOne({ where: { id: category_id, user_id: req.user.id } });
      if (!cat) return res.status(400).json({ error: 'Invalid category' });
    }

    // Check for duplicate
    const existing = await Budget.findOne({
      where: {
        user_id: req.user.id,
        category_id: category_id || null,
        period,
      },
    });
    if (existing) {
      return res.status(409).json({ error: 'Budget already exists for this category and period' });
    }

    const budget = await Budget.create({
      user_id: req.user.id,
      amount, period, start_date,
      end_date: end_date || null,
      category_id: category_id || null,
      alert_threshold: alert_threshold || 80,
    });

    const result = await Budget.findByPk(budget.id, {
      include: [{ model: Category, as: 'category' }],
    });
    res.status(201).json({ budget: result });
  } catch (err) { next(err); }
});

/** PUT /api/budgets/:id */
router.put('/:id', authenticate, uuidParam, async (req, res, next) => {
  try {
    const budget = await Budget.findOne({
      where: { id: req.params.id, user_id: req.user.id },
    });
    if (!budget) return res.status(404).json({ error: 'Budget not found' });

    const { amount, period, start_date, end_date, alert_threshold } = req.body;
    if (amount) budget.amount = amount;
    if (period) budget.period = period;
    if (start_date) budget.start_date = start_date;
    if (end_date !== undefined) budget.end_date = end_date;
    if (alert_threshold) budget.alert_threshold = alert_threshold;

    await budget.save();
    const result = await Budget.findByPk(budget.id, {
      include: [{ model: Category, as: 'category' }],
    });
    res.json({ budget: result });
  } catch (err) { next(err); }
});

/** DELETE /api/budgets/:id */
router.delete('/:id', authenticate, uuidParam, async (req, res, next) => {
  try {
    const budget = await Budget.findOne({
      where: { id: req.params.id, user_id: req.user.id },
    });
    if (!budget) return res.status(404).json({ error: 'Budget not found' });
    await budget.destroy();
    res.json({ message: 'Budget deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
