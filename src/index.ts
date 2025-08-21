#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { searchImages, downloadImage, calculateRelevanceScore, fetchImageAsBase64, initializeApiConfig } from "./api.js";
import { ImageSearchResult } from "./types.js";
import dotenv from "dotenv";
import { z } from "zod";

// Load environment variables
dotenv.config();

// Initialize API configuration
try {
  initializeApiConfig();
} catch (error: any) {
  console.error("[Error] API configuration failed:", error.message);
  console.error("[Help] Please set either:");
  console.error("  - GOOGLE_API_KEY + GOOGLE_CSE_ID (for Google Custom Search API)");
  console.error("  - SERP_API_KEY (for SerpAPI)");
  process.exit(1);
}

// Store image search results for resource access
const imageSearchResults = new Map<string, ImageSearchResult[]>();

// Generate unique resource ID for each search
function generateSearchId(): string {
  return `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Create MCP server
const server = new McpServer({
  name: "Google Image Search",
  version: "1.0.0"
});

// Add search images tool
server.tool(
  "search_images",
  "Search for images using Google Image Search",
  {
    query: z.string().describe("The search query for finding images"),
    limit: z.number().optional().describe("Maximum number of results to return (default: 10)")
  },
  async (args, _extra) => {
    try {
      const { query, limit = 10 } = args;
      
      console.error(`[Tool] Executing search_images with query: "${query}", limit: ${limit}`);
      const results = await searchImages(query, limit);
      
      // Generate unique search ID and store results
      const searchId = generateSearchId();
      imageSearchResults.set(searchId, results);
      
      // Add resource URIs to each image
      const resultsWithResources = results.map((image, index) => ({
        ...image,
        resourceUri: `image/${searchId}/${index}`,
        index: index
      }));
      
      // Create content with text and search results
      const content = [
        { 
          type: "text", 
          text: `Found ${results.length} images for query "${query}". Each image has a resourceUri that can be used to view the image.` 
        },
        {
          type: "text",
          text: JSON.stringify(resultsWithResources, null, 2)
        }
      ];
      
      console.error(`[Tool] Stored ${results.length} images for search ID: ${searchId}`);
      return { content } as any;
    } catch (error: any) {
      console.error("[Error] search_images failed:", error);
      return {
        isError: true,
        content: [
          { 
            type: "text", 
            text: `Failed to search for images: ${error.message}` 
          }
        ]
      } as any;
    }
  }
);

// Add download image tool
server.tool(
  "download_image",
  "Download an image to a local directory",
  {
    imageUrl: z.string().describe("URL of the image to download"),
    outputPath: z.string().describe("Directory path where the image should be saved"),
    filename: z.string().describe("Filename for the downloaded image (including extension)")
  },
  async (args, _extra) => {
    try {
      const { imageUrl, outputPath, filename } = args;
      
      console.error(`[Tool] Executing download_image for URL: ${imageUrl}`);
      const savedPath = await downloadImage(imageUrl, outputPath, filename);
      
      return {
        content: [
          { 
            type: "text", 
            text: `Image successfully downloaded to: ${savedPath}` 
          }
        ]
      };
    } catch (error: any) {
      console.error("[Error] download_image failed:", error);
      return {
        isError: true,
        content: [
          { 
            type: "text", 
            text: `Failed to download image: ${error.message}` 
          }
        ]
      };
    }
  }
);

// Add analyze images tool
server.tool(
  "analyze_images",
  "Analyze image search results to find the most relevant ones",
  {
    searchResults: z.array(z.object({
      title: z.string(),
      link: z.string(),
      original: z.string(),
      source: z.string(),
      width: z.number().optional(),
      height: z.number().optional(),
      is_product: z.boolean().optional()
    })).describe("Array of image search results to analyze"),
    criteria: z.string().describe("Criteria for selecting the best images (e.g., 'professional', 'colorful', etc.)")
  },
  async (args, _extra) => {
    try {
      const { searchResults, criteria } = args;
      
      console.error(`[Tool] Executing analyze_images with criteria: "${criteria}"`);
      
      // Calculate relevance scores and add recommendations
      const analyzedResults = searchResults.map(img => ({
        ...img,
        relevanceScore: calculateRelevanceScore(img as ImageSearchResult, criteria),
      }));
      
      // Sort by relevance score
      analyzedResults.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
      
      // Add recommendations based on ranking
      const resultsWithRecommendations = analyzedResults.map((img, index) => ({
        ...img,
        recommendation: index < 3 ? "Highly recommended" : 
                        index < 6 ? "Recommended" : 
                        "Standard option"
      }));
      
      return {
        content: [
          { 
            type: "text", 
            text: `Analyzed ${resultsWithRecommendations.length} images based on criteria: "${criteria}"` 
          },
          {
            type: "text",
            text: JSON.stringify(resultsWithRecommendations, null, 2)
          }
        ]
      };
    } catch (error: any) {
      console.error("[Error] analyze_images failed:", error);
      return {
        isError: true,
        content: [
          { 
            type: "text", 
            text: `Failed to analyze images: ${error.message}` 
          }
        ]
      };
    }
  }
);

// Add MCP resource handler for image display
server.resource(
  "image_resource",
  "image/{searchId}/{imageIndex}",
  async (uri: URL) => {
    try {
      const uriString = uri.toString();
      console.error(`[Resource] Requested URI: ${uriString}`);
      console.error(`[Resource] URI pathname: ${uri.pathname}`);
      
      // Parse the URI to extract searchId and imageIndex
      const pathname = uri.pathname || uriString;
      const match = pathname.match(/image\/([^\/]+)\/(\d+)$/);
      console.error(`[Resource] Pattern match result: ${match ? 'found' : 'not found'}`);
      if (!match) {
        console.error(`[Resource] Failed to match pattern 'image/{searchId}/{imageIndex}' in: ${pathname}`);
        throw new Error(`Invalid resource URI format: ${pathname}`);
      }
      
      const [, searchId, imageIndexStr] = match;
      const imageIndex = parseInt(imageIndexStr, 10);
      
      // Find the search results
      const searchResults = imageSearchResults.get(searchId);
      if (!searchResults) {
        throw new Error("Search results not found or expired");
      }
      
      // Get the specific image
      const image = searchResults[imageIndex];
      if (!image) {
        throw new Error("Image not found in search results");
      }
      
      // Fetch image data as Base64
      console.error(`[Resource] Fetching image from: ${image.original}`);
      const { data, mimeType } = await fetchImageAsBase64(image.original);
      console.error(`[Resource] Image fetched successfully, mimeType: ${mimeType}, data length: ${data.length}`);
      
      const result = {
        contents: [
          {
            blob: data,  // Base64 string
            uri: uriString,
            mimeType
          }
        ]
      };
      
      console.error(`[Resource] Returning result with ${result.contents.length} contents`);
      return result;
    } catch (error: any) {
      console.error(`[Error] Resource handler failed for ${uri}:`, error);
      throw error;
    }
  }
);

console.error("[Setup] MCP resource handler configured");

// Start server
async function main() {
  try {
    // Connect to transport
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("[Setup] Server started successfully");
  } catch (error) {
    console.error("[Error] Failed to start server:", error);
    process.exit(1);
  }
}

main();