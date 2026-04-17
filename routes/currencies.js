/**
 * Currency Routes
 */
const express = require('express');
const router = express.Router();
const { getSupportedCurrencies, convertCurrency } = require('../services/currencyService');

/** GET /api/currencies */
router.get('/', (req, res) => {
  res.json({ currencies: getSupportedCurrencies() });
});

/** GET /api/currencies/convert */
router.get('/convert', async (req, res, next) => {
  try {
    const { amount, from, to } = req.query;
    if (!amount || !from || !to) {
      return res.status(400).json({ error: 'amount, from, and to are required' });
    }
    const result = await convertCurrency(parseFloat(amount), from.toUpperCase(), to.toUpperCase());
    res.json({ ...result, from, to, original_amount: parseFloat(amount) });
  } catch (err) { next(err); }
});

module.exports = router;
