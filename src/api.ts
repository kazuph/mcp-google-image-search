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
 * Fetch image data as Base64 for MCP resource usage
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
    
    // Determine MIME type from headers or URL
    let mimeType = response.headers['content-type'] || 'image/jpeg';
    if (!mimeType.startsWith('image/')) {
      // Fallback based on URL extension
      if (imageUrl.toLowerCase().includes('.png')) {
        mimeType = 'image/png';
      } else if (imageUrl.toLowerCase().includes('.gif')) {
        mimeType = 'image/gif';
      } else if (imageUrl.toLowerCase().includes('.webp')) {
        mimeType = 'image/webp';
      } else {
        mimeType = 'image/jpeg';
      }
    }
    
    // Convert to Base64
    const base64Data = Buffer.from(response.data).toString('base64');
    
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
 * Download an image to the specified directory (secure implementation)
 */
export async function downloadImage(
  imageUrl: string, 
  outputPath: string, 
  filename: string
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
    
    // Sanitize file path to prevent directory traversal
    const fullPath = sanitizeFilePath(expandedOutputPath, filename);
    
    // Download using axios (secure alternative to curl)
    const response = await axios.get(imageUrl, { 
      responseType: 'stream',
      timeout: 30000,
      maxRedirects: 5,
      maxContentLength: 50 * 1024 * 1024 // 50MB limit
    });
    
    // Write to file using stream
    const writer = fs.createWriteStream(fullPath);
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.error(`[API] Image downloaded successfully to: ${fullPath}`);
        resolve(fullPath);
      });
      writer.on('error', (error) => {
        // Clean up failed download
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
        reject(error);
      });
    });
  } catch (error) {
    console.error("[Error] Failed to download image:", error);
    throw error;
  }
}