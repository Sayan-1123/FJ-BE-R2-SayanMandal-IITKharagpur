/**
 * Budget & Category Tests
 */
const request = require('supertest');
const app = require('../server');
const { sequelize } = require('../models');

jest.spyOn(console, 'log').mockImplementation(() => {});

describe('Categories API', () => {
  let token;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Cat Tester', email: 'cat@test.com', password: 'TestPass123' });
    token = res.body.token;
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('should list default categories', async () => {
    const res = await request(app)
      .get('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.categories.length).toBeGreaterThan(0);
  });

  it('should create a new category', async () => {
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Category', type: 'expense', icon: '🧪', color: '#ff0000' })
      .expect(201);

    expect(res.body.category.name).toBe('Test Category');
  });

  it('should reject duplicate category', async () => {
    await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Category', type: 'expense' })
      .expect(409);
  });

  it('should filter by type', async () => {
    const res = await request(app)
      .get('/api/categories?type=income')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    res.body.categories.forEach(c => expect(c.type).toBe('income'));
  });

  it('should delete category and handle transactions', async () => {
    const cats = await request(app)
      .get('/api/categories?type=expense')
      .set('Authorization', `Bearer ${token}`);

    const catToDelete = cats.body.categories[0];

    // Add a transaction to this category
    await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'expense', amount: '10.00', category_id: catToDelete.id, description: 'test' });

    // Delete category
    const res = await request(app)
      .delete(`/api/categories/${catToDelete.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.affected_transactions).toBe(1);
  });
});

describe('Budgets API', () => {
  let token;
  let categoryId;
  let budgetId;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Budget Tester', email: 'budget@test.com', password: 'TestPass123' });
    token = res.body.token;

    const cats = await request(app)
      .get('/api/categories?type=expense')
      .set('Authorization', `Bearer ${token}`);
    categoryId = cats.body.categories[0]?.id;
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('should create a budget', async () => {
    const res = await request(app)
      .post('/api/budgets')
      .set('Authorization', `Bearer ${token}`)
      .send({
        category_id: categoryId,
        amount: '500.00',
        period: 'monthly',
        start_date: '2026-04-01',
        alert_threshold: 80,
      })
      .expect(201);

    expect(res.body.budget).toBeDefined();
    expect(res.body.budget.amount).toBe('500.00');
    budgetId = res.body.budget.id;
  });

  it('should reject duplicate budget', async () => {
    await request(app)
      .post('/api/budgets')
      .set('Authorization', `Bearer ${token}`)
      .send({
        category_id: categoryId,
        amount: '600.00',
        period: 'monthly',
        start_date: '2026-04-01',
      })
      .expect(409);
  });

  it('should list budgets with progress', async () => {
    // Add a transaction
    await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'expense', amount: '200.00', category_id: categoryId, date: new Date().toISOString().split('T')[0] });

    const res = await request(app)
      .get('/api/budgets')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.budgets.length).toBeGreaterThan(0);
    const budget = res.body.budgets.find(b => b.id === budgetId);
    expect(budget).toBeDefined();
    expect(parseFloat(budget.spent)).toBeGreaterThan(0);
    expect(budget.percentage).toBeGreaterThan(0);
  });

  it('should update a budget', async () => {
    const res = await request(app)
      .put(`/api/budgets/${budgetId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: '750.00' })
      .expect(200);

    expect(res.body.budget.amount).toBe('750.00');
  });

  it('should delete a budget', async () => {
    await request(app)
      .delete(`/api/budgets/${budgetId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });
});
