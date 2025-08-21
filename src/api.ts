import axios from "axios";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { ImageSearchResult, SearchResponse, GoogleSearchResponse, GoogleImageItem } from "./types.js";

// API configuration and state management
interface ApiConfig {
  googleApiKey?: string;
  googleCseId?: string;
  serpApiKey?: string;
}

enum ApiProvider {
  GOOGLE_CUSTOM_SEARCH = 'google',
  SERP_API = 'serp'
}

interface ApiState {
  currentProvider: ApiProvider;
  googleDisabled: boolean;
  serpDisabled: boolean;
}

let apiConfig: ApiConfig = {};
let apiState: ApiState = {
  currentProvider: ApiProvider.GOOGLE_CUSTOM_SEARCH,
  googleDisabled: false,
  serpDisabled: false
};

/**
 * Initialize API configuration from environment variables
 */
export function initializeApiConfig(): void {
  apiConfig = {
    googleApiKey: process.env.GOOGLE_API_KEY,
    googleCseId: process.env.GOOGLE_CSE_ID,
    serpApiKey: process.env.SERP_API_KEY
  };

  // Determine default provider based on available credentials
  const hasGoogleConfig = apiConfig.googleApiKey && apiConfig.googleCseId;
  const hasSerpConfig = apiConfig.serpApiKey;

  if (hasGoogleConfig) {
    apiState.currentProvider = ApiProvider.GOOGLE_CUSTOM_SEARCH;
    console.error('[API] Using Google Custom Search API as primary provider');
  } else if (hasSerpConfig) {
    apiState.currentProvider = ApiProvider.SERP_API;
    console.error('[API] Using SerpAPI as primary provider (Google config not available)');
  } else {
    throw new Error('No valid API configuration found. Please set either (GOOGLE_API_KEY + GOOGLE_CSE_ID) or SERP_API_KEY');
  }
}

/**
 * Switch to alternative API provider when rate limit is hit
 */
function switchApiProvider(): boolean {
  if (apiState.currentProvider === ApiProvider.GOOGLE_CUSTOM_SEARCH && !apiState.serpDisabled && apiConfig.serpApiKey) {
    apiState.currentProvider = ApiProvider.SERP_API;
    apiState.googleDisabled = true;
    console.error('[API] Switched to SerpAPI due to Google API rate limit');
    return true;
  } else if (apiState.currentProvider === ApiProvider.SERP_API && !apiState.googleDisabled && apiConfig.googleApiKey && apiConfig.googleCseId) {
    apiState.currentProvider = ApiProvider.GOOGLE_CUSTOM_SEARCH;
    apiState.serpDisabled = true;
    console.error('[API] Switched to Google Custom Search API due to SerpAPI rate limit');
    return true;
  }
  
  console.error('[API] No alternative API provider available');
  return false;
}

/**
 * Convert Google Custom Search API result to common ImageSearchResult format
 */
function convertGoogleResultToCommonFormat(item: GoogleImageItem, index: number): ImageSearchResult {
  return {
    position: index + 1,
    thumbnail: item.image.thumbnailLink,
    source: item.displayLink,
    title: item.title,
    link: item.image.contextLink,
    original: item.link,
    is_product: false, // Google Custom Search doesn't provide this info directly
    size: `${item.image.width}x${item.image.height}`,
    width: item.image.width,
    height: item.image.height
  };
}

/**
 * Search for images using Google Custom Search API
 */
async function searchImagesViaGoogle(query: string, limit: number): Promise<ImageSearchResult[]> {
  if (!apiConfig.googleApiKey || !apiConfig.googleCseId) {
    throw new Error('Google API configuration not available');
  }

  console.error(`[API] Searching via Google Custom Search API with query: "${query}"`);
  
  const response = await axios.get<GoogleSearchResponse>('https://customsearch.googleapis.com/customsearch/v1', {
    params: {
      key: apiConfig.googleApiKey,
      cx: apiConfig.googleCseId,
      q: query,
      searchType: 'image',
      num: Math.min(limit, 10), // Google Custom Search API max is 10 per request
      safe: 'active'
    }
  });

  if (!response.data.items) {
    throw new Error('No image results found');
  }

  return response.data.items.slice(0, limit).map((item, index) => 
    convertGoogleResultToCommonFormat(item, index)
  );
}

/**
 * Search for images using SerpAPI
 */
async function searchImagesViaSerpAPI(query: string, limit: number): Promise<ImageSearchResult[]> {
  if (!apiConfig.serpApiKey) {
    throw new Error('SerpAPI configuration not available');
  }

  console.error(`[API] Searching via SerpAPI with query: "${query}"`);
  
  const response = await axios.get<SearchResponse>("https://serpapi.com/search", {
    params: {
      q: query,
      engine: "google_images",
      ijn: "0",
      api_key: apiConfig.serpApiKey
    }
  });
  
  if (!response.data.images_results) {
    throw new Error("No image results found");
  }
  
  return response.data.images_results.slice(0, limit);
}

/**
 * Check if an error indicates rate limiting
 */
function isRateLimitError(error: any): boolean {
  if (!error.response) return false;
  
  const status = error.response.status;
  const data = error.response.data;
  
  // Google Custom Search API rate limit indicators
  if (status === 429 || status === 403) {
    return true;
  }
  
  // SerpAPI rate limit indicators
  if (status === 429 || (data && data.error && 
      (data.error.includes('rate limit') || 
       data.error.includes('quota') || 
       data.error.includes('limit exceeded')))) {
    return true;
  }
  
  return false;
}

/**
 * Search for images using the currently configured API with automatic fallback
 */
export async function searchImages(query: string, limit: number = 10): Promise<ImageSearchResult[]> {
  console.error(`[API] Searching for images with query: "${query}"`);
  
  let lastError: any;
  
  // Try current provider
  try {
    if (apiState.currentProvider === ApiProvider.GOOGLE_CUSTOM_SEARCH) {
      return await searchImagesViaGoogle(query, limit);
    } else {
      return await searchImagesViaSerpAPI(query, limit);
    }
  } catch (error) {
    lastError = error;
    console.error(`[Error] ${apiState.currentProvider} failed:`, error);
    
    // Check if it's a rate limit error and try to switch
    if (isRateLimitError(error)) {
      console.error('[API] Rate limit detected, attempting to switch provider');
      
      if (switchApiProvider()) {
        try {
          // Retry with the alternative provider
          if (apiState.currentProvider === ApiProvider.GOOGLE_CUSTOM_SEARCH) {
            return await searchImagesViaGoogle(query, limit);
          } else {
            return await searchImagesViaSerpAPI(query, limit);
          }
        } catch (fallbackError) {
          console.error(`[Error] Fallback ${apiState.currentProvider} also failed:`, fallbackError);
          lastError = fallbackError;
        }
      }
    }
  }
  
  // If we get here, both providers failed or switching wasn't possible
  console.error("[Error] All available image search providers have failed");
  throw lastError;
}

/**
 * Calculate relevance score for an image based on criteria
 */
export function calculateRelevanceScore(image: ImageSearchResult, criteria: string): number {
  // Simple relevance calculation - in a real implementation, this would be more sophisticated
  let score = 0;
  
  // Check if title contains any of the criteria keywords
  const criteriaKeywords = criteria.toLowerCase().split(/\s+/);
  const titleLower = image.title.toLowerCase();
  
  criteriaKeywords.forEach(keyword => {
    if (titleLower.includes(keyword)) {
      score += 2;
    }
  });
  
  // Higher resolution images get a better score
  if (image.width && image.height) {
    const resolution = image.width * image.height;
    if (resolution > 1000000) score += 3; // > 1 megapixel
    else if (resolution > 500000) score += 2; // > 0.5 megapixel
    else score += 1;
  }
  
  // Non-product images might be better for certain use cases
  if (!image.is_product) {
    score += 1;
  }
  
  return score;
}

/**
 * Detect image format from binary data using magic bytes/file signatures
 */
function detectImageFormat(buffer: Buffer): { extension: string; mimeType: string } | null {
  // Check for various image format signatures
  
  // JPEG: FF D8 FF
  if (buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return { extension: 'jpg', mimeType: 'image/jpeg' };
  }
  
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buffer.length >= 8 && 
      buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
      buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A) {
    return { extension: 'png', mimeType: 'image/png' };
  }
  
  // GIF87a or GIF89a: 47 49 46 38 37 61 or 47 49 46 38 39 61
  if (buffer.length >= 6 && 
      buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38 &&
      (buffer[4] === 0x37 || buffer[4] === 0x39) && buffer[5] === 0x61) {
    return { extension: 'gif', mimeType: 'image/gif' };
  }
  
  // WebP: 52 49 46 46 ... 57 45 42 50
  if (buffer.length >= 12 && 
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
    return { extension: 'webp', mimeType: 'image/webp' };
  }
  
  // BMP: 42 4D
  if (buffer.length >= 2 && buffer[0] === 0x42 && buffer[1] === 0x4D) {
    return { extension: 'bmp', mimeType: 'image/bmp' };
  }
  
  // ICO: 00 00 01 00
  if (buffer.length >= 4 && 
      buffer[0] === 0x00 && buffer[1] === 0x00 && buffer[2] === 0x01 && buffer[3] === 0x00) {
    return { extension: 'ico', mimeType: 'image/x-icon' };
  }
  
  // TIFF (Intel): 49 49 2A 00
  if (buffer.length >= 4 && 
      buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2A && buffer[3] === 0x00) {
    return { extension: 'tiff', mimeType: 'image/tiff' };
  }
  
  // TIFF (Motorola): 4D 4D 00 2A
  if (buffer.length >= 4 && 
      buffer[0] === 0x4D && buffer[1] === 0x4D && buffer[2] === 0x00 && buffer[3] === 0x2A) {
    return { extension: 'tiff', mimeType: 'image/tiff' };
  }
  
  // SVG: Check for XML declaration and svg tag (text-based format)
  const textContent = buffer.toString('utf8', 0, Math.min(buffer.length, 1000));
  if (textContent.includes('<svg') && (textContent.includes('xmlns="http://www.w3.org/2000/svg"') || textContent.includes("xmlns='http://www.w3.org/2000/svg'"))) {
    return { extension: 'svg', mimeType: 'image/svg+xml' };
  }
  
  return null;
}

/**
 * Validate if the URL is safe for downloading
 */
function isValidImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }
    
    // Block internal network addresses
    const blockedPatterns = [
      /^localhost$/i,
      /^127\./,
      /^169\.254\./,
      /^192\.168\./,
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[01])\./
    ];
    
    return !blockedPatterns.some(pattern => pattern.test(parsed.hostname));
  } catch {
    return false;
  }
}

/**
 * Sanitize file path to prevent directory traversal attacks
 */
function sanitizeFilePath(outputPath: string, filename: string): string {
  // Check for directory traversal patterns first
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    throw new Error('Invalid file path: directory traversal detected');
  }
  
  // Remove any remaining dangerous characters
  const safeName = filename.replace(/[<>:"|?*]/g, '_');
  const safePath = path.resolve(outputPath);
  
  // Construct full path
  const fullPath = path.join(safePath, safeName);
  
  // Final security check
  if (!fullPath.startsWith(safePath)) {
    throw new Error('Invalid file path: directory traversal detected');
  }
  
  return fullPath;
}

/**
 * Fetch image data as Base64 for MCP resource usage with auto-format detection
 */
export async function fetchImageAsBase64(imageUrl: string): Promise<{
  data: string;
  mimeType: string;
}> {
  try {
    // Validate URL for security
    if (!isValidImageUrl(imageUrl)) {
      throw new Error('Invalid or unsafe URL');
    }
    
    // Download image data
    const response = await axios.get(imageUrl, { 
      responseType: 'arraybuffer',
      timeout: 15000,
      maxContentLength: 10 * 1024 * 1024, // 10MB limit
      maxRedirects: 3
    });
    
    const imageBuffer = Buffer.from(response.data);
    
    // Detect the actual image format from binary data
    const detectedFormat = detectImageFormat(imageBuffer);
    let mimeType: string;
    
    if (detectedFormat) {
      mimeType = detectedFormat.mimeType;
      console.error(`[API] Auto-detected image format: ${mimeType}`);
    } else {
      // Fallback to header-based detection or default
      mimeType = response.headers['content-type'] || 'image/jpeg';
      if (!mimeType.startsWith('image/')) {
        mimeType = 'image/jpeg';
      }
      console.error(`[API] Could not detect format from binary data, using: ${mimeType}`);
    }
    
    // Convert to Base64
    const base64Data = imageBuffer.toString('base64');
    
    return {
      data: base64Data,
      mimeType: mimeType
    };
  } catch (error) {
    console.error(`[Error] Failed to fetch image data from ${imageUrl}:`, error);
    throw new Error(`Failed to fetch image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Download an image to the specified directory (secure implementation with auto-format detection)
 */
export async function downloadImage(
  imageUrl: string, 
  outputPath: string, 
  baseFilename: string
): Promise<string> {
  console.error(`[API] Downloading image from: ${imageUrl}`);
  
  try {
    // Validate URL for security
    if (!isValidImageUrl(imageUrl)) {
      throw new Error('Invalid or unsafe URL');
    }
    
    // Expand tilde (~) in output path
    const expandedOutputPath = outputPath.startsWith('~') 
      ? path.join(os.homedir(), outputPath.slice(1))
      : outputPath;
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(expandedOutputPath)) {
      fs.mkdirSync(expandedOutputPath, { recursive: true });
    }
    
    // First download the image to buffer to detect format
    const response = await axios.get(imageUrl, { 
      responseType: 'arraybuffer',
      timeout: 30000,
      maxRedirects: 5,
      maxContentLength: 50 * 1024 * 1024 // 50MB limit
    });
    
    const imageBuffer = Buffer.from(response.data);
    
    // Detect the actual image format from binary data
    const detectedFormat = detectImageFormat(imageBuffer);
    if (!detectedFormat) {
      throw new Error('Unable to detect image format from downloaded data');
    }
    
    console.error(`[API] Detected image format: ${detectedFormat.mimeType} (${detectedFormat.extension})`);
    
    // Generate filename with correct extension
    const cleanBaseFilename = baseFilename.replace(/\.[^/.]+$/, ''); // Remove any existing extension
    const finalFilename = `${cleanBaseFilename}.${detectedFormat.extension}`;
    
    // Sanitize file path to prevent directory traversal
    const fullPath = sanitizeFilePath(expandedOutputPath, finalFilename);
    
    // Write the buffer to file
    fs.writeFileSync(fullPath, imageBuffer);
    
    console.error(`[API] Image downloaded successfully to: ${fullPath}`);
    return fullPath;
  } catch (error) {
    console.error("[Error] Failed to download image:", error);
    throw error;
  }
}