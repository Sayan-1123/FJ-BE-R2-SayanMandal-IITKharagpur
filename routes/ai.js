/**
 * AI Routes
 * OpenAI-powered financial insights, chat, and bank statement import
 */
const express = require('express');
const router = express.Router();
const { Op, fn, col } = require('sequelize');
const { Transaction, Category } = require('../models');
const { authenticate } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimiter');
const { generateInsights, categorizeTransaction, chat } = require('../services/aiService');
const { processCSVFile, processPDFFile } = require('../services/bankStatementService');
const { scanForAnomalies } = require('../services/anomalyService');
const { uploadStatement } = require('../config/multer');
const { convertCurrency } = require('../services/currencyService');
const path = require('path');
const fs = require('fs');

/** GET /api/ai/insights — AI-generated financial insights */
router.get('/insights', authenticate, aiLimiter, async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const transactions = await Transaction.findAll({
      where: {
        user_id: req.user.id,
        date: { [Op.gte]: new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000) },
      },
      include: [{ model: Category, as: 'category', attributes: ['name', 'type'] }],
      order: [['date', 'DESC']],
    });

    const insights = await generateInsights(transactions, req.user.default_currency);
    res.json(insights);
  } catch (err) { next(err); }
});

/** POST /api/ai/chat — Financial chatbot */
router.post('/chat', authenticate, aiLimiter, async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    // Build financial context
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [income, expenses] = await Promise.all([
      Transaction.sum('converted_amount', {
        where: { user_id: req.user.id, type: 'income', date: { [Op.gte]: monthStart } },
      }),
      Transaction.sum('converted_amount', {
        where: { user_id: req.user.id, type: 'expense', date: { [Op.gte]: monthStart } },
      }),
    ]);

    const context = {
      currency: req.user.default_currency,
      monthly_income: parseFloat(income || 0).toFixed(2),
      monthly_expenses: parseFloat(expenses || 0).toFixed(2),
      net: (parseFloat(income || 0) - parseFloat(expenses || 0)).toFixed(2),
    };

    const result = await chat(message, context);
    res.json(result);
  } catch (err) { next(err); }
});

/** POST /api/ai/categorize — Auto-categorize a description */
router.post('/categorize', authenticate, async (req, res, next) => {
  try {
    const { description } = req.body;
    if (!description) return res.status(400).json({ error: 'Description is required' });

    const categories = await Category.findAll({ where: { user_id: req.user.id } });
    const result = await categorizeTransaction(description, categories);
    res.json({ suggestion: result });
  } catch (err) { next(err); }
});

/** GET /api/ai/anomalies — Scan for spending anomalies */
router.get('/anomalies', authenticate, async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const anomalies = await scanForAnomalies(req.user.id, Transaction, parseInt(days));
    res.json({
      anomalies: anomalies.map((a) => ({
        transaction_id: a.transaction.id,
        amount: a.transaction.amount,
        currency: a.transaction.currency,
        description: a.transaction.description,
        date: a.transaction.date,
        type: a.transaction.type,
        reasons: a.reasons,
        score: a.score,
      })),
      total: anomalies.length,
    });
  } catch (err) { next(err); }
});

/** POST /api/ai/import-statement — Import bank statement */
router.post('/import-statement', authenticate, uploadStatement.single('statement'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const ext = path.extname(req.file.originalname).toLowerCase();
    let parsedRows;
    if (ext === '.csv') {
      parsedRows = await processCSVFile(req.file.path);
    } else if (ext === '.pdf') {
      parsedRows = await processPDFFile(req.file.path);
    } else {
      return res.status(400).json({ error: 'Unsupported file format' });
    }

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    if (parsedRows.length === 0) {
      return res.json({ imported: 0, duplicates: 0, message: 'No transactions found in file' });
    }

    const userCurrency = req.user.default_currency || 'USD';
    let imported = 0, duplicates = 0, errors = 0;

    for (const row of parsedRows) {
      try {
        // Check for duplicates
        const existing = await Transaction.findOne({
          where: { import_hash: row.import_hash },
        });
        if (existing) { duplicates++; continue; }

        await Transaction.create({
          user_id: req.user.id,
          type: row.type,
          amount: row.amount,
          currency: userCurrency,
          exchange_rate: 1,
          converted_amount: row.amount,
          description: row.description,
          date: row.date,
          import_hash: row.import_hash,
        });
        imported++;
      } catch (err) { errors++; }
    }

    res.json({
      imported,
      duplicates,
      errors,
      total_parsed: parsedRows.length,
      message: `Successfully imported ${imported} transaction(s)`,
    });
  } catch (err) { next(err); }
});

module.exports = router;
