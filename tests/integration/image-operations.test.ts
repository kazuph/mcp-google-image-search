import { describe, test, expect, beforeAll, afterEach } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { searchImages, downloadImage } from '../../src/api.js';

// Claude CLIを使った画像内容検証
async function verifyImageContent(imagePath: string, expectedContent: string): Promise<boolean> {
  const prompt = `This image should be related to "${expectedContent}". 
                  Analyze the image and respond with only "true" if it's related, or "false" if not.
                  Response must be exactly "true" or "false" with no additional text.`;
  
  try {
    const command = `claude -p "${prompt}" "${imagePath}"`;
    const result = execSync(command, { encoding: 'utf-8' }).trim().toLowerCase();
    
    return result === 'true';
  } catch (error) {
    console.error('Vision verification failed:', error);
    return false;
  }
}

describe('Google Image Search MCP Server', () => {
  const downloadDir = './tests/fixtures/downloads';
  
  beforeAll(() => {
    // ダウンロードディレクトリを作成
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }
    
    // APIキーの確認 - プレースホルダーは使用しない
    const hasGoogleAPI = process.env.GOOGLE_API_KEY && process.env.GOOGLE_CSE_ID;
    const hasSerpAPI = process.env.SERP_API_KEY;
    
    if (!hasGoogleAPI && !hasSerpAPI) {
      console.warn('No valid API keys found. Real API tests will be skipped.');
    }
  });
  
  afterEach(() => {
    // テスト後のクリーンアップ
    try {
      const files = fs.readdirSync(downloadDir);
      files.forEach(file => {
        const filePath = path.join(downloadDir, file);
        if (fs.statSync(filePath).isFile()) {
          fs.unlinkSync(filePath);
        }
      });
    } catch (error) {
      // ディレクトリが存在しない場合は無視
    }
  });
  
  describe('Image Search and Download with Vision Verification', () => {
    test('should search and download Komatsu IoT case study images', async () => {
      // APIキーがない場合はテストをスキップ
      const hasGoogleAPI = process.env.GOOGLE_API_KEY && process.env.GOOGLE_CSE_ID;
      const hasSerpAPI = process.env.SERP_API_KEY;
      
      if (!hasGoogleAPI && !hasSerpAPI) {
        console.log('Skipping real API test - no valid API keys found');
        return;
      }
      
      // 1. 「コマツ IoT 事例」で画像検索
      const searchResults = await searchImages('コマツ IoT 事例', 5);
      expect(searchResults).toBeDefined();
      expect(searchResults.length).toBeGreaterThan(0);
      
      // 検索結果の構造を検証
      expect(searchResults[0]).toHaveProperty('title');
      expect(searchResults[0]).toHaveProperty('link');
      expect(searchResults[0]).toHaveProperty('original');
      
      console.log(`Found ${searchResults.length} images for "コマツ IoT 事例"`);
      console.log(`First image: ${searchResults[0].title} - ${searchResults[0].original}`);
      
      // 2. 最初の画像をダウンロード
      const firstImage = searchResults[0];
      const filename = 'komatsu_iot_test.jpg';
      
      const savedPath = await downloadImage(
        firstImage.original,
        downloadDir,
        filename
      );
      
      // 3. ファイルが存在することを確認
      expect(fs.existsSync(savedPath)).toBe(true);
      
      // ファイルサイズが0でないことを確認
      const stats = fs.statSync(savedPath);
      expect(stats.size).toBeGreaterThan(0);
      
      console.log(`Downloaded image to: ${savedPath} (${stats.size} bytes)`);
      
      // 4. Claude Vision APIで画像内容を検証
      const isRelevant = await verifyImageContent(
        savedPath,
        'Komatsu IoT, construction equipment, or industrial technology'
      );
      
      expect(isRelevant).toBe(true);
      
      console.log(`Vision verification result: ${isRelevant ? 'PASS' : 'FAIL'}`);
    }, 120000); // タイムアウトを2分に設定
    
    test('should handle invalid URL gracefully', async () => {
      await expect(
        downloadImage('invalid-url', downloadDir, 'test.jpg')
      ).rejects.toThrow();
    });
    
    test('should handle non-existent image URL', async () => {
      await expect(
        downloadImage('https://example.com/non-existent-image.jpg', downloadDir, 'test.jpg')
      ).rejects.toThrow();
    });
    
    test('should validate search results structure', async () => {
      // APIキーがない場合はテストをスキップ
      const hasGoogleAPI = process.env.GOOGLE_API_KEY && process.env.GOOGLE_CSE_ID;
      const hasSerpAPI = process.env.SERP_API_KEY;
      
      if (!hasGoogleAPI && !hasSerpAPI) {
        console.log('Skipping real API test - no valid API keys found');
        return;
      }
      
      const searchResults = await searchImages('test query', 3);
      
      if (searchResults.length > 0) {
        const result = searchResults[0];
        expect(typeof result.title).toBe('string');
        expect(typeof result.link).toBe('string');
        expect(typeof result.original).toBe('string');
        
        // Optional fields
        if (result.width !== undefined) {
          expect(typeof result.width).toBe('number');
        }
        if (result.height !== undefined) {
          expect(typeof result.height).toBe('number');
        }
        if (result.is_product !== undefined) {
          expect(typeof result.is_product).toBe('boolean');
        }
      }
    });
  });
});