import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';

describe('Auth API', () => {
  describe('POST /api/v1/auth/register', () => {
    it('should register a new vendor', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          fullName: 'Test User',
          role: 'VENDOR',
        });

      expect(response.status).toBe(201);
      expect(response.body.status).toBe('success');
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.tokens).toBeDefined();
    });

    it('should reject duplicate email', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'duplicate@example.com',
          password: 'password123',
          fullName: 'User One',
        });

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'duplicate@example.com',
          password: 'password123',
          fullName: 'User Two',
        });

      expect(response.status).toBe(409);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'incomplete@example.com',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login with valid credentials', async () => {
      // First register a user
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'login@example.com',
          password: 'password123',
          fullName: 'Login User',
        });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'login@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.tokens.accessToken).toBeDefined();
    });

    it('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
    });
  });
});

describe('Public API', () => {
  describe('GET /api/v1/public/cities', () => {
    it('should return list of Moroccan cities', async () => {
      const response = await request(app)
        .get('/api/v1/public/cities');

      expect(response.status).toBe(200);
      expect(response.body.data.cities).toBeInstanceOf(Array);
    });
  });

  describe('GET /api/v1/public/categories', () => {
    it('should return list of categories', async () => {
      const response = await request(app)
        .get('/api/v1/public/categories');

      expect(response.status).toBe(200);
      expect(response.body.data.categories).toBeInstanceOf(Array);
    });
  });

  describe('GET /api/v1/public/stats', () => {
    it('should return platform stats', async () => {
      const response = await request(app)
        .get('/api/v1/public/stats');

      expect(response.status).toBe(200);
      expect(response.body.data.stats).toBeDefined();
    });
  });
});

describe('Health Check', () => {
  it('should return health status', async () => {
    const response = await request(app)
      .get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });
});
