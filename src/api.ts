import axios from "axios";
import { exec } from "child_process";
import { promisify } from "util";
import * as path from "path";
import * as fs from "fs";
import { ImageSearchResult, SearchResponse } from "./types.js";

const execAsync = promisify(exec);

/**
 * Search for images using the SerpAPI
 */
export async function searchImages(query: string, limit: number = 10): Promise<ImageSearchResult[]> {
  console.error(`[API] Searching for images with query: "${query}"`);
  
  try {
    const response = await axios.get<SearchResponse>("https://serpapi.com/search", {
      params: {
        q: query,
        engine: "google_images",
        ijn: "0",
        api_key: process.env.SERP_API_KEY
      }
    });
    
    if (!response.data.images_results) {
      throw new Error("No image results found");
    }
    
    return response.data.images_results.slice(0, limit);
  } catch (error) {
    console.error("[Error] Failed to search images:", error);
    throw error;
  }
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
 * Download an image to the specified directory
 */
export async function downloadImage(
  imageUrl: string, 
  outputPath: string, 
  filename: string
): Promise<string> {
  console.error(`[API] Downloading image from: ${imageUrl}`);
  
  try {
    // Create directory if it doesn't exist
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }
    
    const fullPath = path.join(outputPath, filename);
    
    // Use curl to download the image
    const command = `curl -o "${fullPath}" "${imageUrl}"`;
    await execAsync(command);
    
    console.error(`[API] Image downloaded successfully to: ${fullPath}`);
    return fullPath;
  } catch (error) {
    console.error("[Error] Failed to download image:", error);
    throw error;
  }
}