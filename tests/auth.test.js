/**
 * Authentication Tests
 */
const request = require('supertest');
const app = require('../server');
const { User, Category, sequelize } = require('../models');

// Suppress server startup logs during tests
jest.spyOn(console, 'log').mockImplementation(() => {});

describe('Auth API', () => {
  let token;
  const testUser = {
    name: 'Test User',
    email: 'test@example.com',
    password: 'TestPass123',
  };

  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(201);

      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe(testUser.email);
      expect(res.body.user.name).toBe(testUser.name);
      expect(res.body.user).not.toHaveProperty('password_hash');
      token = res.body.token;
    });

    it('should seed default categories on registration', async () => {
      const categories = await Category.findAll({
        where: { user_id: (await User.findOne({ where: { email: testUser.email } })).id },
      });
      expect(categories.length).toBeGreaterThan(0);
      expect(categories.some(c => c.type === 'income')).toBe(true);
      expect(categories.some(c => c.type === 'expense')).toBe(true);
    });

    it('should reject duplicate email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(409);

      expect(res.body.error).toContain('already registered');
    });

    it('should reject weak password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...testUser, email: 'weak@example.com', password: '123' })
        .expect(400);

      expect(res.body.error).toBe('Validation failed');
    });

    it('should reject invalid email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...testUser, email: 'not-an-email' })
        .expect(400);

      expect(res.body.error).toBe('Validation failed');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with correct credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(200);

      expect(res.body).toHaveProperty('token');
      expect(res.body.user.email).toBe(testUser.email);
      token = res.body.token;
    });

    it('should reject incorrect password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: 'WrongPass123' })
        .expect(401);

      expect(res.body.error).toContain('Invalid');
    });

    it('should reject non-existent email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'ghost@example.com', password: 'TestPass123' })
        .expect(401);

      expect(res.body.error).toContain('Invalid');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return user profile with valid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.user.email).toBe(testUser.email);
    });

    it('should reject without token', async () => {
      await request(app)
        .get('/api/auth/me')
        .expect(401);
    });

    it('should reject with invalid token', async () => {
      await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalidtoken123')
        .expect(401);
    });
  });

  describe('PUT /api/auth/profile', () => {
    it('should update user profile', async () => {
      const res = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Name', default_currency: 'EUR' })
        .expect(200);

      expect(res.body.user.name).toBe('Updated Name');
      expect(res.body.user.default_currency).toBe('EUR');
    });
  });

  describe('PUT /api/auth/password', () => {
    it('should change password', async () => {
      await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ current_password: testUser.password, new_password: 'NewPass123!' })
        .expect(200);

      // Login with new password
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: 'NewPass123!' })
        .expect(200);

      token = res.body.token;
    });

    it('should reject wrong current password', async () => {
      await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ current_password: 'WrongOld123', new_password: 'NewPass456!' })
        .expect(401);
    });
  });
});
