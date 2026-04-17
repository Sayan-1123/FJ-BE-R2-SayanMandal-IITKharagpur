/**
 * Transaction Tests
 */
const request = require('supertest');
const app = require('../server');
const { User, Category, Transaction, sequelize } = require('../models');

jest.spyOn(console, 'log').mockImplementation(() => {});

describe('Transactions API', () => {
  let token;
  let userId;
  let categoryId;
  let transactionId;

  beforeAll(async () => {
    await sequelize.sync({ force: true });

    // Create test user
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Tx Tester', email: 'tx@test.com', password: 'TestPass123' });

    token = res.body.token;
    userId = res.body.user.id;

    // Get a category
    const catRes = await request(app)
      .get('/api/categories')
      .set('Authorization', `Bearer ${token}`);

    categoryId = catRes.body.categories.find(c => c.type === 'expense')?.id;
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('POST /api/transactions', () => {
    it('should create an expense transaction', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: 'expense',
          amount: '45.99',
          description: 'Grocery shopping',
          date: '2026-04-15',
          category_id: categoryId,
        })
        .expect(201);

      expect(res.body.transaction).toBeDefined();
      expect(res.body.transaction.amount).toBe('45.99');
      expect(res.body.transaction.type).toBe('expense');
      transactionId = res.body.transaction.id;
    });

    it('should create an income transaction', async () => {
      const incomeCat = await Category.findOne({
        where: { user_id: userId, type: 'income' },
      });

      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: 'income',
          amount: '5000.00',
          description: 'Monthly salary',
          date: '2026-04-01',
          category_id: incomeCat?.id,
        })
        .expect(201);

      expect(res.body.transaction.type).toBe('income');
      expect(res.body.transaction.amount).toBe('5000.00');
    });

    it('should handle negative amounts (refunds)', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: 'expense',
          amount: '-25.50',
          description: 'Refund from store',
          date: '2026-04-10',
        })
        .expect(201);

      expect(parseFloat(res.body.transaction.amount)).toBe(-25.50);
    });

    it('should handle decimal precision correctly', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: 'expense',
          amount: '99.99',
          description: 'Precision test',
          date: '2026-04-12',
        })
        .expect(201);

      expect(res.body.transaction.amount).toBe('99.99');
    });

    it('should support multi-currency', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: 'expense',
          amount: '100.00',
          currency: 'EUR',
          description: 'European purchase',
          date: '2026-04-14',
        })
        .expect(201);

      expect(res.body.transaction.currency).toBe('EUR');
      expect(res.body.transaction.exchange_rate).toBeDefined();
      expect(res.body.transaction.converted_amount).toBeDefined();
    });

    it('should reject invalid type', async () => {
      await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'invalid', amount: '50.00' })
        .expect(400);
    });

    it('should reject without auth', async () => {
      await request(app)
        .post('/api/transactions')
        .send({ type: 'expense', amount: '50.00' })
        .expect(401);
    });
  });

  describe('GET /api/transactions', () => {
    it('should list transactions with pagination', async () => {
      const res = await request(app)
        .get('/api/transactions')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.transactions).toBeInstanceOf(Array);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.total).toBeGreaterThan(0);
    });

    it('should filter by type', async () => {
      const res = await request(app)
        .get('/api/transactions?type=income')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      res.body.transactions.forEach(tx => {
        expect(tx.type).toBe('income');
      });
    });

    it('should filter by date range', async () => {
      const res = await request(app)
        .get('/api/transactions?start_date=2026-04-01&end_date=2026-04-30')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.transactions.length).toBeGreaterThan(0);
    });

    it('should search by description', async () => {
      const res = await request(app)
        .get('/api/transactions?search=grocery')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.transactions.length).toBeGreaterThan(0);
      expect(res.body.transactions[0].description.toLowerCase()).toContain('grocery');
    });
  });

  describe('GET /api/transactions/:id', () => {
    it('should get a single transaction', async () => {
      const res = await request(app)
        .get(`/api/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.transaction.id).toBe(transactionId);
    });

    it('should return 404 for non-existent transaction', async () => {
      await request(app)
        .get('/api/transactions/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  describe('PUT /api/transactions/:id', () => {
    it('should update a transaction', async () => {
      const res = await request(app)
        .put(`/api/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: '50.00', description: 'Updated grocery shopping' })
        .expect(200);

      expect(res.body.transaction.amount).toBe('50.00');
      expect(res.body.transaction.description).toBe('Updated grocery shopping');
    });
  });

  describe('DELETE /api/transactions/:id', () => {
    it('should delete a transaction', async () => {
      await request(app)
        .delete(`/api/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Verify it's gone
      await request(app)
        .get(`/api/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });
});
