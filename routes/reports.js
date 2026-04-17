/**
 * Reporting Routes
 * Financial reports generation with date ranges
 */
const express = require('express');
const router = express.Router();
const { Op, fn, col } = require('sequelize');
const { Transaction, Category } = require('../models');
const { authenticate } = require('../middleware/auth');

/** GET /api/reports/monthly — Monthly income vs expenses */
router.get('/monthly', authenticate, async (req, res, next) => {
  try {
    const { year, months = 12 } = req.query;
    const targetYear = parseInt(year) || new Date().getFullYear();
    const numMonths = Math.min(parseInt(months), 24);

    const startDate = new Date(targetYear, new Date().getMonth() - numMonths + 1, 1);
    const endDate = new Date();

    const transactions = await Transaction.findAll({
      where: {
        user_id: req.user.id,
        date: { [Op.between]: [startDate, endDate] },
      },
      attributes: ['type', 'date', 'converted_amount'],
      order: [['date', 'ASC']],
    });

    // Group by month
    const monthlyData = {};
    transactions.forEach((tx) => {
      const d = new Date(tx.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyData[key]) monthlyData[key] = { month: key, income: 0, expenses: 0 };
      const amount = parseFloat(tx.converted_amount || 0);
      if (tx.type === 'income') monthlyData[key].income += amount;
      else monthlyData[key].expenses += amount;
    });

    const report = Object.values(monthlyData).map((m) => ({
      ...m,
      income: m.income.toFixed(2),
      expenses: m.expenses.toFixed(2),
      net: (m.income - m.expenses).toFixed(2),
      savings_rate: m.income > 0 ? ((m.income - m.expenses) / m.income * 100).toFixed(1) : '0.0',
    }));

    res.json({ report, currency: req.user.default_currency });
  } catch (err) { next(err); }
});

/** GET /api/reports/category — Spending by category */
router.get('/category', authenticate, async (req, res, next) => {
  try {
    const { start_date, end_date, type = 'expense' } = req.query;
    const now = new Date();
    const start = start_date || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const end = end_date || now.toISOString().split('T')[0];

    const data = await Transaction.findAll({
      where: {
        user_id: req.user.id,
        type,
        date: { [Op.between]: [start, end] },
      },
      attributes: [
        'category_id',
        [fn('SUM', col('converted_amount')), 'total'],
        [fn('COUNT', col('Transaction.id')), 'count'],
        [fn('AVG', col('converted_amount')), 'average'],
        [fn('MIN', col('converted_amount')), 'min'],
        [fn('MAX', col('converted_amount')), 'max'],
      ],
      include: [{ model: Category, as: 'category', attributes: ['name', 'icon', 'color'] }],
      group: ['category_id', 'category.id'],
      order: [[fn('SUM', col('converted_amount')), 'DESC']],
    });

    const grandTotal = data.reduce((sum, d) => sum + parseFloat(d.dataValues.total), 0);

    const report = data.map((d) => ({
      category: d.category || { name: 'Uncategorized', icon: '📁', color: '#6b7280' },
      total: parseFloat(d.dataValues.total).toFixed(2),
      count: parseInt(d.dataValues.count),
      average: parseFloat(d.dataValues.average).toFixed(2),
      min: parseFloat(d.dataValues.min).toFixed(2),
      max: parseFloat(d.dataValues.max).toFixed(2),
      percentage: grandTotal > 0 ? ((parseFloat(d.dataValues.total) / grandTotal) * 100).toFixed(1) : '0',
    }));

    res.json({ report, grand_total: grandTotal.toFixed(2), currency: req.user.default_currency });
  } catch (err) { next(err); }
});

/** GET /api/reports/trends — Daily/weekly/monthly trends */
router.get('/trends', authenticate, async (req, res, next) => {
  try {
    const { period = 'daily', days = 30 } = req.query;
    const startDate = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);

    const transactions = await Transaction.findAll({
      where: {
        user_id: req.user.id,
        date: { [Op.gte]: startDate },
      },
      attributes: ['type', 'date', 'converted_amount'],
      order: [['date', 'ASC']],
    });

    const grouped = {};
    transactions.forEach((tx) => {
      const d = new Date(tx.date);
      let key;
      if (period === 'weekly') {
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        key = weekStart.toISOString().split('T')[0];
      } else if (period === 'monthly') {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      } else {
        key = tx.date;
      }
      if (!grouped[key]) grouped[key] = { date: key, income: 0, expenses: 0 };
      const amount = parseFloat(tx.converted_amount || 0);
      if (tx.type === 'income') grouped[key].income += amount;
      else grouped[key].expenses += amount;
    });

    res.json({
      trends: Object.values(grouped).map((g) => ({
        ...g,
        income: g.income.toFixed(2),
        expenses: g.expenses.toFixed(2),
        net: (g.income - g.expenses).toFixed(2),
      })),
      currency: req.user.default_currency,
    });
  } catch (err) { next(err); }
});

/** GET /api/reports/summary — Period summary */
router.get('/summary', authenticate, async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    const now = new Date();
    const start = start_date || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const end = end_date || now.toISOString().split('T')[0];

    const [income, expenses, txCount] = await Promise.all([
      Transaction.sum('converted_amount', {
        where: { user_id: req.user.id, type: 'income', date: { [Op.between]: [start, end] } },
      }),
      Transaction.sum('converted_amount', {
        where: { user_id: req.user.id, type: 'expense', date: { [Op.between]: [start, end] } },
      }),
      Transaction.count({
        where: { user_id: req.user.id, date: { [Op.between]: [start, end] } },
      }),
    ]);

    const totalIncome = parseFloat(income || 0);
    const totalExpenses = parseFloat(expenses || 0);

    res.json({
      period: { start, end },
      total_income: totalIncome.toFixed(2),
      total_expenses: totalExpenses.toFixed(2),
      net_savings: (totalIncome - totalExpenses).toFixed(2),
      savings_rate: totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome * 100).toFixed(1) : '0.0',
      transaction_count: txCount,
      avg_daily_expense: totalExpenses > 0
        ? (totalExpenses / Math.max(1, Math.ceil((new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24)))).toFixed(2)
        : '0.00',
      currency: req.user.default_currency,
    });
  } catch (err) { next(err); }
});

module.exports = router;
