/**
 * Validation Middleware
 * Request validation using express-validator
 */
const { body, query, param, validationResult } = require('express-validator');

/**
 * Process validation results
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

// ==================== AUTH VALIDATORS ====================

const registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain a number'),
  validate,
];

const loginValidation = [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
  validate,
];

// ==================== TRANSACTION VALIDATORS ====================

const transactionValidation = [
  body('type').isIn(['income', 'expense']).withMessage('Type must be income or expense'),
  body('amount')
    .isDecimal({ decimal_digits: '0,2' })
    .withMessage('Amount must be a valid decimal with up to 2 decimal places'),
  body('description').optional().trim().isLength({ max: 500 }),
  body('date').optional().isISO8601().withMessage('Date must be a valid ISO date'),
  body('currency').optional().isLength({ min: 3, max: 3 }).withMessage('Currency must be a 3-letter code'),
  body('category_id').optional({ values: 'null' }).isUUID().withMessage('Invalid category ID'),
  validate,
];

// ==================== BUDGET VALIDATORS ====================

const budgetValidation = [
  body('amount')
    .isDecimal({ decimal_digits: '0,2' })
    .withMessage('Amount must be a valid decimal')
    .custom((val) => parseFloat(val) > 0).withMessage('Amount must be positive'),
  body('period').isIn(['weekly', 'monthly', 'yearly']).withMessage('Invalid period'),
  body('start_date').isISO8601().withMessage('Start date must be a valid date'),
  body('end_date').optional({ values: 'null' }).isISO8601().withMessage('End date must be a valid date'),
  body('category_id').optional({ values: 'null' }).isUUID().withMessage('Invalid category ID'),
  body('alert_threshold').optional().isInt({ min: 1, max: 100 }).withMessage('Threshold must be 1-100'),
  validate,
];

// ==================== CATEGORY VALIDATORS ====================

const categoryValidation = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  body('type').isIn(['income', 'expense']).withMessage('Type must be income or expense'),
  body('icon').optional().trim(),
  body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/).withMessage('Color must be a hex code'),
  validate,
];

// ==================== QUERY VALIDATORS ====================

const paginationValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
  validate,
];

const dateRangeValidation = [
  query('start_date').optional().isISO8601().withMessage('Start date must be valid'),
  query('end_date').optional().isISO8601().withMessage('End date must be valid'),
  validate,
];

const uuidParam = [
  param('id').isUUID().withMessage('Invalid ID format'),
  validate,
];

module.exports = {
  validate,
  registerValidation,
  loginValidation,
  transactionValidation,
  budgetValidation,
  categoryValidation,
  paginationValidation,
  dateRangeValidation,
  uuidParam,
};
