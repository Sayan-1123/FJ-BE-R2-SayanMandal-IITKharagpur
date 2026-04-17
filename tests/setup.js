/**
 * Test Configuration
 * This file runs before all test suites via Jest setupFiles
 */

// Override database for testing — must happen BEFORE any model imports
process.env.DB_NAME = process.env.DB_NAME_TEST || 'finance_tracker_test';
process.env.NODE_ENV = 'test';

// Suppress noisy logs during tests
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'info').mockImplementation(() => {});
