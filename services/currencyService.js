/**
 * Currency Service
 * Handles exchange rate fetching and multi-currency conversion
 */
const Decimal = require('decimal.js');

// In-memory cache for exchange rates
let rateCache = {};
let lastFetchTime = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

// Fallback rates (approximate, used when API is unavailable)
const FALLBACK_RATES = {
  USD: 1, EUR: 0.92, GBP: 0.79, INR: 83.12, JPY: 149.50,
  CAD: 1.36, AUD: 1.53, CHF: 0.88, CNY: 7.24, SGD: 1.34,
  HKD: 7.82, NZD: 1.67, SEK: 10.42, NOK: 10.55, DKK: 6.88,
  ZAR: 18.20, BRL: 4.97, MXN: 17.15, KRW: 1320.0, THB: 35.50,
  MYR: 4.72, PHP: 56.50, IDR: 15650.0, TWD: 31.80, AED: 3.67,
  SAR: 3.75, RUB: 91.50, TRY: 27.20, PLN: 4.05, CZK: 22.50,
};

/**
 * Fetch latest exchange rates from API
 */
const fetchRates = async (baseCurrency = 'USD') => {
  const now = Date.now();
  if (lastFetchTime && now - lastFetchTime < CACHE_DURATION && rateCache[baseCurrency]) {
    return rateCache[baseCurrency];
  }

  try {
    const apiKey = process.env.EXCHANGE_RATE_API_KEY;
    if (apiKey && apiKey !== 'your-exchange-rate-api-key') {
      const response = await fetch(
        `https://v6.exchangerate-api.com/v6/${apiKey}/latest/${baseCurrency}`
      );
      const data = await response.json();
      if (data.result === 'success') {
        rateCache[baseCurrency] = data.conversion_rates;
        lastFetchTime = now;
        return data.conversion_rates;
      }
    }
  } catch (err) {
    console.warn('Exchange rate API failed, using fallback rates:', err.message);
  }

  // Fallback: convert through USD
  const baseToUSD = FALLBACK_RATES[baseCurrency] || 1;
  const rates = {};
  for (const [currency, usdRate] of Object.entries(FALLBACK_RATES)) {
    rates[currency] = new Decimal(usdRate).div(baseToUSD).toNumber();
  }
  return rates;
};

/**
 * Convert amount between currencies
 */
const convertCurrency = async (amount, fromCurrency, toCurrency) => {
  if (fromCurrency === toCurrency) {
    return { convertedAmount: parseFloat(amount), exchangeRate: 1 };
  }

  const rates = await fetchRates(fromCurrency);
  const rate = rates[toCurrency];
  if (!rate) {
    throw new Error(`Unsupported currency: ${toCurrency}`);
  }

  const convertedAmount = new Decimal(amount).times(rate).toDecimalPlaces(2).toNumber();
  return { convertedAmount, exchangeRate: rate };
};

/**
 * Get supported currencies
 */
const getSupportedCurrencies = () => {
  return Object.keys(FALLBACK_RATES).map((code) => ({
    code,
    name: getCurrencyName(code),
  }));
};

const getCurrencyName = (code) => {
  const names = {
    USD: 'US Dollar', EUR: 'Euro', GBP: 'British Pound', INR: 'Indian Rupee',
    JPY: 'Japanese Yen', CAD: 'Canadian Dollar', AUD: 'Australian Dollar',
    CHF: 'Swiss Franc', CNY: 'Chinese Yuan', SGD: 'Singapore Dollar',
    HKD: 'Hong Kong Dollar', NZD: 'New Zealand Dollar', SEK: 'Swedish Krona',
    NOK: 'Norwegian Krone', DKK: 'Danish Krone', ZAR: 'South African Rand',
    BRL: 'Brazilian Real', MXN: 'Mexican Peso', KRW: 'South Korean Won',
    THB: 'Thai Baht', MYR: 'Malaysian Ringgit', PHP: 'Philippine Peso',
    IDR: 'Indonesian Rupiah', TWD: 'New Taiwan Dollar', AED: 'UAE Dirham',
    SAR: 'Saudi Riyal', RUB: 'Russian Ruble', TRY: 'Turkish Lira',
    PLN: 'Polish Zloty', CZK: 'Czech Koruna',
  };
  return names[code] || code;
};

module.exports = { fetchRates, convertCurrency, getSupportedCurrencies, FALLBACK_RATES };
