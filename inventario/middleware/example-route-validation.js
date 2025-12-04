/**
 * Example: How to use validation middleware in routes
 * Copy patterns from this file to your actual route files
 */

const express = require('express');
const router = express.Router();
const { body, query, param, validationResult } = require('express-validator');
const { validationRules, handleValidationErrors } = require('./validators');

// Example 1: POST with email and password validation
router.post('/register',
  // Validation chain
  validationRules.email(),
  validationRules.password(),
  validationRules.username(),
  // Error handler
  handleValidationErrors,
  // Route handler
  (req, res) => {
    // At this point, inputs are validated and sanitized
    const { email, password, username } = req.body;
    console.log('Creating user:', { email, username });
    res.status(201).json({ success: true, message: 'User created' });
  }
);

// Example 2: GET with pagination and search
router.get('/users',
  // Validation chain
  ...validationRules.pagination(),
  validationRules.search(),
  // Error handler
  handleValidationErrors,
  // Route handler
  (req, res) => {
    const { page = 1, limit = 10, search } = req.query;
    console.log('Fetching users:', { page, limit, search });
    res.json({ success: true, page, limit, search });
  }
);

// Example 3: PUT with ID validation
router.put('/users/:id',
  // Validation chain
  validationRules.id('id'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail(),
  // Error handler
  handleValidationErrors,
  // Route handler
  (req, res) => {
    const { id } = req.params;
    const { name, email } = req.body;
    console.log('Updating user:', { id, name, email });
    res.json({ success: true, message: 'User updated', id });
  }
);

// Example 4: DELETE with ID validation
router.delete('/users/:id',
  // Validation chain
  validationRules.id('id'),
  // Error handler
  handleValidationErrors,
  // Route handler
  (req, res) => {
    const { id } = req.params;
    console.log('Deleting user:', id);
    res.json({ success: true, message: 'User deleted', id });
  }
);

// Example 5: Complex validation with custom rules
router.post('/products',
  // Standard validations
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Product name is required')
    .isLength({ max: 255 })
    .withMessage('Product name must be less than 255 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),

  body('price')
    .notEmpty()
    .withMessage('Price is required')
    .isFloat({ min: 0.01 })
    .withMessage('Price must be greater than 0'),

  body('quantity')
    .notEmpty()
    .withMessage('Quantity is required')
    .isInt({ min: 0 })
    .withMessage('Quantity must be a non-negative integer'),

  // Custom validation: Check SKU format
  body('sku')
    .optional()
    .custom(value => {
      const skuPattern = /^[A-Z0-9]{3,20}$/;
      if (!skuPattern.test(value)) {
        throw new Error('SKU must be 3-20 uppercase alphanumeric characters');
      }
      return true;
    }),

  // Error handler
  handleValidationErrors,

  // Route handler
  (req, res) => {
    const { name, description, price, quantity, sku } = req.body;
    console.log('Creating product:', { name, price, quantity, sku });
    res.status(201).json({
      success: true,
      message: 'Product created',
      product: { name, price, quantity }
    });
  }
);

// Example 6: Using advanced query validation
router.get('/products/search',
  // Validation
  query('keyword')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search keyword must be 1-100 characters'),

  query('minPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Min price must be non-negative'),

  query('maxPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Max price must be non-negative'),

  query('sortBy')
    .optional()
    .isIn(['name', 'price', 'quantity'])
    .withMessage('Sort by must be: name, price, or quantity'),

  query('order')
    .optional()
    .isIn(['ASC', 'DESC'])
    .withMessage('Order must be ASC or DESC'),

  ...validationRules.pagination(),

  // Error handler
  handleValidationErrors,

  // Route handler
  (req, res) => {
    const filters = {
      keyword: req.query.keyword,
      minPrice: req.query.minPrice,
      maxPrice: req.query.maxPrice,
      sortBy: req.query.sortBy || 'name',
      order: req.query.order || 'ASC',
      page: req.query.page || 1,
      limit: req.query.limit || 10,
    };
    console.log('Searching products with filters:', filters);
    res.json({ success: true, filters });
  }
);

// Example 7: Validation with conditional rules
router.post('/orders',
  body('items')
    .isArray({ min: 1 })
    .withMessage('Order must contain at least one item'),

  body('items.*.productId')
    .notEmpty()
    .withMessage('Product ID is required'),

  body('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('Quantity must be at least 1'),

  body('shippingAddress')
    .notEmpty()
    .withMessage('Shipping address is required')
    .isLength({ min: 10, max: 500 })
    .withMessage('Address must be 10-500 characters'),

  body('paymentMethod')
    .notEmpty()
    .isIn(['credit_card', 'debit_card', 'paypal', 'bank_transfer'])
    .withMessage('Invalid payment method'),

  handleValidationErrors,

  (req, res) => {
    const { items, shippingAddress, paymentMethod } = req.body;
    console.log('Creating order:', { itemCount: items.length, paymentMethod });
    res.status(201).json({
      success: true,
      message: 'Order created',
      orderId: 'ORD-12345'
    });
  }
);

// Example 8: Manual validation for complex scenarios
router.post('/batch-import',
  body('data')
    .custom(async (data) => {
      if (!Array.isArray(data)) {
        throw new Error('Data must be an array');
      }

      if (data.length === 0) {
        throw new Error('Data array cannot be empty');
      }

      if (data.length > 1000) {
        throw new Error('Maximum 1000 items per request');
      }

      // Validate each item
      for (let i = 0; i < data.length; i++) {
        const item = data[i];
        if (!item.id || !item.name) {
          throw new Error(`Item ${i + 1} is missing required fields`);
        }
      }

      return true;
    }),

  handleValidationErrors,

  (req, res) => {
    const { data } = req.body;
    console.log(`Importing ${data.length} items`);
    res.status(202).json({
      success: true,
      message: 'Batch import started',
      itemCount: data.length
    });
  }
);

module.exports = router;

/**
 * KEY POINTS:
 *
 * 1. Always chain validation rules in this order:
 *    - body/query/param validators
 *    - handleValidationErrors middleware
 *    - Route handler
 *
 * 2. Use validationRules for common patterns:
 *    - validationRules.email()
 *    - validationRules.password()
 *    - validationRules.id()
 *
 * 3. Combine multiple validators:
 *    - body('field').rule1().rule2().rule3()
 *
 * 4. Always sanitize input:
 *    - .trim() for strings
 *    - .toInt() for numbers
 *    - .normalizeEmail() for emails
 *
 * 5. Provide clear error messages
 *    - .withMessage('Clear explanation')
 *
 * 6. Use custom validation for complex rules:
 *    - .custom(value => { /* validation logic */ })
 *
 * 7. Test all validation paths:
 *    - Valid data → should succeed
 *    - Invalid data → should return 400 with errors
 *    - Missing required fields → should return 400
 */
