import request from 'supertest';
import app from './app';

describe('App', () => {
  describe('Health Check', () => {
    it('should return 200 and health status', async () => {
      const response = await request(app).get('/api/v1/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'API is healthy');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('Not Found Handler', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await request(app).get('/api/v1/non-existent-route');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('not found');
    });
  });
});
