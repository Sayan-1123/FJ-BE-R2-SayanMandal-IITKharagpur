/**
 * Dashboard Routes
 * Financial overview, summary statistics, and chart data
 */
const express = require('express');
const router = express.Router();
const { Op, fn, col, literal } = require('sequelize');
const { Transaction, Category, Budget, Notification } = require('../models');
const { authenticate } = require('../middleware/auth');

/** GET /api/dashboard — Full financial overview */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Current month totals
    const [income, expenses] = await Promise.all([
      Transaction.sum('converted_amount', {
        where: { user_id: userId, type: 'income', date: { [Op.between]: [monthStart, monthEnd] } },
      }),
      Transaction.sum('converted_amount', {
        where: { user_id: userId, type: 'expense', date: { [Op.between]: [monthStart, monthEnd] } },
      }),
    ]);

    const totalIncome = parseFloat(income || 0);
    const totalExpenses = parseFloat(expenses || 0);
    const savings = totalIncome - totalExpenses;

    // Previous month for comparison
    const [prevIncome, prevExpenses] = await Promise.all([
      Transaction.sum('converted_amount', {
        where: { user_id: userId, type: 'income', date: { [Op.between]: [prevMonthStart, monthStart] } },
      }),
      Transaction.sum('converted_amount', {
        where: { user_id: userId, type: 'expense', date: { [Op.between]: [prevMonthStart, monthStart] } },
      }),
    ]);

    // Category breakdown (expenses)
    const expenseByCategory = await Transaction.findAll({
      where: { user_id: userId, type: 'expense', date: { [Op.between]: [monthStart, monthEnd] } },
      attributes: ['category_id', [fn('SUM', col('converted_amount')), 'total']],
      include: [{ model: Category, as: 'category', attributes: ['name', 'icon', 'color'] }],
      group: ['category_id', 'category.id'],
      order: [[fn('SUM', col('converted_amount')), 'DESC']],
    });

    // Income by category
    const incomeByCategory = await Transaction.findAll({
      where: { user_id: userId, type: 'income', date: { [Op.between]: [monthStart, monthEnd] } },
      attributes: ['category_id', [fn('SUM', col('converted_amount')), 'total']],
      include: [{ model: Category, as: 'category', attributes: ['name', 'icon', 'color'] }],
      group: ['category_id', 'category.id'],
      order: [[fn('SUM', col('converted_amount')), 'DESC']],
    });

    // Daily trend (last 30 days)
    const dailyTrend = await Transaction.findAll({
      where: {
        user_id: userId,
        date: { [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      attributes: [
        'date', 'type',
        [fn('SUM', col('converted_amount')), 'total'],
      ],
      group: ['date', 'type'],
      order: [['date', 'ASC']],
    });

    // Recent transactions
    const recentTransactions = await Transaction.findAll({
      where: { user_id: userId },
      include: [{ model: Category, as: 'category', attributes: ['name', 'icon', 'color'] }],
      order: [['date', 'DESC'], ['created_at', 'DESC']],
      limit: 10,
    });

    // Budget summaries
    const budgets = await Budget.findAll({
      where: { user_id: userId },
      include: [{ model: Category, as: 'category', attributes: ['name', 'icon', 'color'] }],
    });

    const budgetSummaries = await Promise.all(
      budgets.map(async (budget) => {
        let periodStart;
        if (budget.period === 'monthly') periodStart = monthStart;
        else if (budget.period === 'weekly') {
          periodStart = new Date(now);
          periodStart.setDate(now.getDate() - now.getDay());
        } else periodStart = new Date(now.getFullYear(), 0, 1);

        const spent = await Transaction.sum('converted_amount', {
          where: {
            user_id: userId, type: 'expense',
            ...(budget.category_id ? { category_id: budget.category_id } : {}),
            date: { [Op.gte]: periodStart },
          },
        }) || 0;

        return {
          id: budget.id,
          category: budget.category,
          amount: budget.amount,
          period: budget.period,
          spent: parseFloat(spent).toFixed(2),
          percentage: Math.round((spent / parseFloat(budget.amount)) * 100),
        };
      })
    );

    // Unread notifications count
    const unreadCount = await Notification.count({
      where: { user_id: userId, is_read: false },
    });

    res.json({
      summary: {
        total_income: totalIncome.toFixed(2),
        total_expenses: totalExpenses.toFixed(2),
        savings: savings.toFixed(2),
        savings_rate: totalIncome > 0 ? ((savings / totalIncome) * 100).toFixed(1) : '0.0',
        currency: req.user.default_currency,
      },
      comparison: {
        prev_income: parseFloat(prevIncome || 0).toFixed(2),
        prev_expenses: parseFloat(prevExpenses || 0).toFixed(2),
        income_change: prevIncome ? (((totalIncome - prevIncome) / prevIncome) * 100).toFixed(1) : null,
        expense_change: prevExpenses ? (((totalExpenses - prevExpenses) / prevExpenses) * 100).toFixed(1) : null,
      },
      expense_by_category: expenseByCategory,
      income_by_category: incomeByCategory,
      daily_trend: dailyTrend,
      recent_transactions: recentTransactions,
      budget_summaries: budgetSummaries,
      unread_notifications: unreadCount,
    });
  } catch (err) { next(err); }
});

module.exports = router;
