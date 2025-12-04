/**
 * Validation Middleware Module
 * Centralizes all input validation rules using express-validator
 */

const { body, query, param, validationResult } = require('express-validator');
const validator = require('validator');

/**
 * Handles validation errors and returns them in a consistent format
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
        value: err.value
      })),
    });
  }
  next();
};

/**
 * Common validation rules
 */
const validationRules = {
  // Email validation
  email: () =>
    body('email')
      .trim()
      .isEmail()
      .withMessage('Invalid email format')
      .normalizeEmail(),

  // Password validation (minimum requirements)
  password: () =>
    body('password')
      .isLength({ min: 12 })
      .withMessage('Password must be at least 12 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain uppercase, lowercase, numbers, and special characters'),

  // Username validation
  username: () =>
    body('username')
      .trim()
      .isLength({ min: 3, max: 30 })
      .withMessage('Username must be between 3 and 30 characters')
      .matches(/^[a-zA-Z0-9_-]+$/)
      .withMessage('Username can only contain letters, numbers, underscore, and hyphen'),

  // ID validation (UUID or numeric)
  id: (paramName = 'id') =>
    param(paramName)
      .custom(value => {
        // Check if it's a valid UUID or positive integer
        const isValidUUID = validator.isUUID(value);
        const isValidInt = Number.isInteger(Number(value)) && Number(value) > 0;
        if (!isValidUUID && !isValidInt) {
          throw new Error('Invalid ID format');
        }
        return true;
      }),

  // Pagination validation
  pagination: () => [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer')
      .toInt(),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
      .toInt(),
  ],

  // Search validation
  search: () =>
    query('search')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Search query must be less than 100 characters'),

  // Date validation
  date: (fieldName = 'date') =>
    body(fieldName)
      .custom(value => {
        if (!validator.isISO8601(value)) {
          throw new Error('Invalid date format. Use ISO 8601 format (YYYY-MM-DD)');
        }
        return true;
      }),

  // URL validation
  url: (fieldName = 'url') =>
    body(fieldName)
      .custom(value => {
        if (!validator.isURL(value, { require_protocol: true })) {
          throw new Error('Invalid URL format');
        }
        return true;
      }),

  // Integer validation
  integer: (fieldName, options = {}) =>
    body(fieldName)
      .isInt(options)
      .withMessage(`${fieldName} must be a valid integer`),

  // String validation with length
  string: (fieldName, minLength = 1, maxLength = 255) =>
    body(fieldName)
      .trim()
      .isLength({ min: minLength, max: maxLength })
      .withMessage(`${fieldName} must be between ${minLength} and ${maxLength} characters`),
};

module.exports = {
  handleValidationErrors,
  validationRules,
};
