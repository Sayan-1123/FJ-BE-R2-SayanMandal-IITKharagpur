/**
 * Dashboard & Reports Tests
 */
const request = require('supertest');
const app = require('../server');
const { sequelize } = require('../models');

jest.spyOn(console, 'log').mockImplementation(() => {});

describe('Dashboard & Reports API', () => {
  let token;
  let categoryId;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Report Tester', email: 'report@test.com', password: 'TestPass123' });
    token = res.body.token;

    const cats = await request(app)
      .get('/api/categories')
      .set('Authorization', `Bearer ${token}`);
    categoryId = cats.body.categories.find(c => c.type === 'expense')?.id;
    const incomeId = cats.body.categories.find(c => c.type === 'income')?.id;

    // Seed some transactions
    const txns = [
      { type: 'income', amount: '5000.00', category_id: incomeId, description: 'Salary', date: '2026-04-01' },
      { type: 'expense', amount: '200.00', category_id: categoryId, description: 'Groceries', date: '2026-04-05' },
      { type: 'expense', amount: '150.00', category_id: categoryId, description: 'Transport', date: '2026-04-10' },
      { type: 'expense', amount: '75.50', category_id: categoryId, description: 'Dining', date: '2026-04-12' },
      { type: 'income', amount: '500.00', category_id: incomeId, description: 'Freelance', date: '2026-04-15' },
    ];

    for (const tx of txns) {
      await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send(tx);
    }
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('GET /api/dashboard', () => {
    it('should return dashboard data', async () => {
      const res = await request(app)
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.summary).toBeDefined();
      expect(res.body.summary.total_income).toBeDefined();
      expect(res.body.summary.total_expenses).toBeDefined();
      expect(res.body.summary.savings).toBeDefined();
      expect(res.body.expense_by_category).toBeInstanceOf(Array);
      expect(res.body.daily_trend).toBeInstanceOf(Array);
      expect(res.body.recent_transactions).toBeInstanceOf(Array);
    });
  });

  describe('GET /api/reports/monthly', () => {
    it('should return monthly report', async () => {
      const res = await request(app)
        .get('/api/reports/monthly?months=12')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.report).toBeInstanceOf(Array);
      if (res.body.report.length > 0) {
        expect(res.body.report[0]).toHaveProperty('month');
        expect(res.body.report[0]).toHaveProperty('income');
        expect(res.body.report[0]).toHaveProperty('expenses');
        expect(res.body.report[0]).toHaveProperty('net');
      }
    });
  });

  describe('GET /api/reports/category', () => {
    it('should return category breakdown', async () => {
      const res = await request(app)
        .get('/api/reports/category')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.report).toBeInstanceOf(Array);
      expect(res.body.grand_total).toBeDefined();
    });
  });

  describe('GET /api/reports/trends', () => {
    it('should return spending trends', async () => {
      const res = await request(app)
        .get('/api/reports/trends?period=daily&days=30')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.trends).toBeInstanceOf(Array);
    });
  });

  describe('GET /api/reports/summary', () => {
    it('should return period summary', async () => {
      const res = await request(app)
        .get('/api/reports/summary?start_date=2026-04-01&end_date=2026-04-30')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.total_income).toBeDefined();
      expect(res.body.total_expenses).toBeDefined();
      expect(res.body.net_savings).toBeDefined();
      expect(res.body.transaction_count).toBeGreaterThan(0);
    });
  });
});

describe('Currencies API', () => {
  it('should list supported currencies', async () => {
    const res = await request(app)
      .get('/api/currencies')
      .expect(200);

    expect(res.body.currencies).toBeInstanceOf(Array);
    expect(res.body.currencies.length).toBeGreaterThan(0);
    expect(res.body.currencies[0]).toHaveProperty('code');
    expect(res.body.currencies[0]).toHaveProperty('name');
  });

  it('should convert currencies', async () => {
    const res = await request(app)
      .get('/api/currencies/convert?amount=100&from=USD&to=EUR')
      .expect(200);

    expect(res.body.convertedAmount).toBeDefined();
    expect(res.body.exchangeRate).toBeDefined();
    expect(res.body.convertedAmount).toBeGreaterThan(0);
  });
});

describe('Health Check', () => {
  it('should return health status', async () => {
    const res = await request(app)
      .get('/api/health')
      .expect(200);

    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });
});
