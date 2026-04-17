/**
 * Transaction Routes
 * Full CRUD with filtering, pagination, multi-currency, anomaly detection
 */
const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const Decimal = require('decimal.js');
const { Transaction, Category, Budget, Notification, User } = require('../models');
const { authenticate } = require('../middleware/auth');
const { transactionValidation, uuidParam } = require('../middleware/validation');
const { convertCurrency } = require('../services/currencyService');
const { detectTransactionAnomaly } = require('../services/anomalyService');
const { sendBudgetAlert, sendAnomalyAlert } = require('../services/emailService');

/** GET /api/transactions — List with filters & pagination */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const {
      page = 1, limit = 15, type, category_id,
      start_date, end_date, search, sort_by = 'date', sort_order = 'DESC',
      currency, min_amount, max_amount,
    } = req.query;

    const where = { user_id: req.user.id };
    if (type) where.type = type;
    if (category_id) where.category_id = category_id;
    if (start_date || end_date) {
      where.date = {};
      if (start_date) where.date[Op.gte] = start_date;
      if (end_date) where.date[Op.lte] = end_date;
    }
    if (search) {
      where.description = { [Op.iLike]: `%${search}%` };
    }
    if (currency) where.currency = currency;
    if (min_amount || max_amount) {
      where.amount = {};
      if (min_amount) where.amount[Op.gte] = parseFloat(min_amount);
      if (max_amount) where.amount[Op.lte] = parseFloat(max_amount);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const allowedSorts = ['date', 'amount', 'created_at'];
    const orderField = allowedSorts.includes(sort_by) ? sort_by : 'date';
    const orderDir = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const { rows, count } = await Transaction.findAndCountAll({
      where,
      include: [{ model: Category, as: 'category', attributes: ['id', 'name', 'type', 'icon', 'color'] }],
      order: [[orderField, orderDir]],
      limit: parseInt(limit),
      offset,
    });

    res.json({
      transactions: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / parseInt(limit)),
      },
    });
  } catch (err) { next(err); }
});

/** GET /api/transactions/:id */
router.get('/:id', authenticate, uuidParam, async (req, res, next) => {
  try {
    const tx = await Transaction.findOne({
      where: { id: req.params.id, user_id: req.user.id },
      include: [{ model: Category, as: 'category' }],
    });
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });
    res.json({ transaction: tx });
  } catch (err) { next(err); }
});

/** POST /api/transactions */
router.post('/', authenticate, transactionValidation, async (req, res, next) => {
  try {
    const { type, amount, description, date, category_id, currency, is_recurring } = req.body;
    const userCurrency = req.user.default_currency || 'USD';
    const txCurrency = currency || userCurrency;

    // Multi-currency conversion
    let exchangeRate = 1, convertedAmount = parseFloat(amount);
    if (txCurrency !== userCurrency) {
      const conv = await convertCurrency(amount, txCurrency, userCurrency);
      exchangeRate = conv.exchangeRate;
      convertedAmount = conv.convertedAmount;
    }

    // Validate category belongs to user
    if (category_id) {
      const cat = await Category.findOne({ where: { id: category_id, user_id: req.user.id } });
      if (!cat) return res.status(400).json({ error: 'Invalid category' });
    }

    const tx = await Transaction.create({
      user_id: req.user.id,
      type, amount, description,
      date: date || new Date().toISOString().split('T')[0],
      category_id: category_id || null,
      currency: txCurrency,
      exchange_rate: exchangeRate,
      converted_amount: convertedAmount,
      is_recurring: is_recurring || false,
    });

    // Anomaly detection
    const anomalyResult = await detectTransactionAnomaly(tx, Transaction);
    if (anomalyResult.isAnomaly) {
      tx.is_anomaly = true;
      tx.anomaly_reason = anomalyResult.reasons.join('; ');
      await tx.save();

      // Create notification
      await Notification.create({
        user_id: req.user.id,
        type: 'anomaly',
        title: 'Unusual Transaction Detected',
        message: anomalyResult.reasons.join('. '),
        priority: 'high',
        metadata: { transaction_id: tx.id },
      });

      // Send email if enabled
      if (req.user.notification_preferences?.email_anomaly_alerts) {
        sendAnomalyAlert(req.user, tx, anomalyResult.reasons.join('. ')).catch(console.error);
      }
    }

    // Budget check
    if (type === 'expense' && category_id) {
      await checkBudgetAlerts(req.user, category_id);
    }

    const result = await Transaction.findByPk(tx.id, {
      include: [{ model: Category, as: 'category' }],
    });
    res.status(201).json({ transaction: result, anomaly: anomalyResult.isAnomaly ? anomalyResult : null });
  } catch (err) { next(err); }
});

/** PUT /api/transactions/:id */
router.put('/:id', authenticate, uuidParam, async (req, res, next) => {
  try {
    const tx = await Transaction.findOne({
      where: { id: req.params.id, user_id: req.user.id },
    });
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });

    const { type, amount, description, date, category_id, currency } = req.body;
    const userCurrency = req.user.default_currency || 'USD';

    if (amount !== undefined || currency !== undefined) {
      const txCurrency = currency || tx.currency;
      const txAmount = amount !== undefined ? amount : tx.amount;
      if (txCurrency !== userCurrency) {
        const conv = await convertCurrency(txAmount, txCurrency, userCurrency);
        tx.exchange_rate = conv.exchangeRate;
        tx.converted_amount = conv.convertedAmount;
        tx.currency = txCurrency;
      } else {
        tx.exchange_rate = 1;
        tx.converted_amount = parseFloat(txAmount);
        tx.currency = txCurrency;
      }
      if (amount !== undefined) tx.amount = amount;
    }

    if (type) tx.type = type;
    if (description !== undefined) tx.description = description;
    if (date) tx.date = date;
    if (category_id !== undefined) tx.category_id = category_id || null;

    await tx.save();

    const result = await Transaction.findByPk(tx.id, {
      include: [{ model: Category, as: 'category' }],
    });
    res.json({ transaction: result });
  } catch (err) { next(err); }
});

/** DELETE /api/transactions/:id */
router.delete('/:id', authenticate, uuidParam, async (req, res, next) => {
  try {
    const tx = await Transaction.findOne({
      where: { id: req.params.id, user_id: req.user.id },
    });
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });

    // Clean up receipt file if exists
    if (tx.receipt_path) {
      const fs = require('fs');
      const path = require('path');
      const fullPath = path.join(__dirname, '..', tx.receipt_path);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }

    await tx.destroy();
    res.json({ message: 'Transaction deleted' });
  } catch (err) { next(err); }
});

// ==================== HELPER ====================

async function checkBudgetAlerts(user, categoryId) {
  try {
    const now = new Date();
    const budgets = await Budget.findAll({
      where: {
        user_id: user.id,
        category_id: categoryId,
        start_date: { [Op.lte]: now },
        [Op.or]: [{ end_date: null }, { end_date: { [Op.gte]: now } }],
      },
    });

    for (const budget of budgets) {
      // Calculate period dates
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
          user_id: user.id,
          category_id: categoryId,
          type: 'expense',
          date: { [Op.gte]: periodStart.toISOString().split('T')[0] },
        },
      }) || 0;

      const percentage = (spent / parseFloat(budget.amount)) * 100;
      if (percentage >= budget.alert_threshold) {
        const category = await Category.findByPk(categoryId);
        const catName = category?.name || 'Unknown';

        // Avoid duplicate notifications (check last 24h)
        const recentNotif = await Notification.findOne({
          where: {
            user_id: user.id,
            type: 'budget_alert',
            created_at: { [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) },
            metadata: { budget_id: budget.id },
          },
        });

        if (!recentNotif) {
          await Notification.create({
            user_id: user.id,
            type: 'budget_alert',
            title: `Budget Alert: ${catName}`,
            message: `You've spent ${percentage.toFixed(0)}% of your ${budget.period} budget for ${catName}`,
            priority: percentage >= 100 ? 'high' : 'medium',
            metadata: { budget_id: budget.id, category_id: categoryId, percentage },
          });

          if (user.notification_preferences?.email_budget_alerts) {
            sendBudgetAlert(user, budget, spent, catName).catch(console.error);
          }
        }
      }
    }
  } catch (err) {
    console.error('Budget alert check error:', err.message);
  }
}

module.exports = router;
