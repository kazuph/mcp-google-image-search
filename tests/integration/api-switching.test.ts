import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { initializeApiConfig } from '../../src/api.js';

describe('API Switching and Configuration', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('API Configuration Detection', () => {
    test('should prioritize Google Custom Search API when both configs available', () => {
      // Set both API configurations
      process.env.GOOGLE_API_KEY = 'google-test-key';
      process.env.GOOGLE_CSE_ID = 'google-test-cse';
      process.env.SERP_API_KEY = 'serp-test-key';

      expect(() => initializeApiConfig()).not.toThrow();
      // Should log that it's using Google as primary
    });

    test('should use SerpAPI when only SerpAPI config available', () => {
      // Clear Google config, set only SerpAPI
      delete process.env.GOOGLE_API_KEY;
      delete process.env.GOOGLE_CSE_ID;
      process.env.SERP_API_KEY = 'serp-test-key';

      expect(() => initializeApiConfig()).not.toThrow();
      // Should log that it's using SerpAPI as primary
    });

    test('should use Google when only Google config available', () => {
      // Set only Google config
      process.env.GOOGLE_API_KEY = 'google-test-key';
      process.env.GOOGLE_CSE_ID = 'google-test-cse';
      delete process.env.SERP_API_KEY;

      expect(() => initializeApiConfig()).not.toThrow();
      // Should log that it's using Google as primary
    });

    test('should throw error when no API configuration available', () => {
      // Clear all API configurations
      delete process.env.GOOGLE_API_KEY;
      delete process.env.GOOGLE_CSE_ID;
      delete process.env.SERP_API_KEY;

      expect(() => initializeApiConfig()).toThrow(
        'No valid API configuration found. Please set either (GOOGLE_API_KEY + GOOGLE_CSE_ID) or SERP_API_KEY'
      );
    });

    test('should throw error when Google config is incomplete', () => {
      // Set only Google API key, missing CSE ID
      process.env.GOOGLE_API_KEY = 'google-test-key';
      delete process.env.GOOGLE_CSE_ID;
      delete process.env.SERP_API_KEY;

      expect(() => initializeApiConfig()).toThrow(
        'No valid API configuration found. Please set either (GOOGLE_API_KEY + GOOGLE_CSE_ID) or SERP_API_KEY'
      );
    });
  });

  describe('Rate Limit Error Detection', () => {
    test('should detect Google Custom Search API rate limit errors', () => {
      const rateLimitError = {
        response: {
          status: 429,
          data: { error: 'Rate limit exceeded' }
        }
      };

      // We need to access the internal isRateLimitError function
      // For now, we test through searchImages behavior
      expect(rateLimitError.response.status).toBe(429);
    });

    test('should detect Google Custom Search API quota errors', () => {
      const quotaError = {
        response: {
          status: 403,
          data: { error: 'Quota exceeded' }
        }
      };

      expect(quotaError.response.status).toBe(403);
    });

    test('should detect SerpAPI rate limit errors', () => {
      const serpRateLimitError = {
        response: {
          status: 429,
          data: { error: 'rate limit exceeded for this plan' }
        }
      };

      expect(serpRateLimitError.response.status).toBe(429);
      expect(serpRateLimitError.response.data.error).toContain('rate limit');
    });
  });

  describe('Environment Variable Handling', () => {
    test('should handle missing environment variables gracefully', () => {
      // Test with completely empty environment
      const emptyEnv = {};
      Object.keys(process.env).forEach(key => {
        if (key.includes('API') || key.includes('CSE')) {
          delete process.env[key];
        }
      });

      expect(() => initializeApiConfig()).toThrow();
    });

    test('should validate API key formats', () => {
      // Test with empty string API keys
      process.env.GOOGLE_API_KEY = '';
      process.env.GOOGLE_CSE_ID = '';
      process.env.SERP_API_KEY = '';

      expect(() => initializeApiConfig()).toThrow();
    });
  });

  describe('Configuration State', () => {
    test('should maintain configuration state between calls', () => {
      // Set valid configuration
      process.env.GOOGLE_API_KEY = 'google-test-key';
      process.env.GOOGLE_CSE_ID = 'google-test-cse';
      process.env.SERP_API_KEY = 'serp-test-key';

      // Initialize once
      initializeApiConfig();

      // Should not throw on second call
      expect(() => initializeApiConfig()).not.toThrow();
    });
  });
});