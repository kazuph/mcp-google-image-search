import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { searchImages, downloadImage, calculateRelevanceScore } from "./api.js";
import { ImageSearchResult } from "./types.js";
import dotenv from "dotenv";
import { z } from "zod";

// Load environment variables
dotenv.config();

// Validate API key
if (!process.env.SERP_API_KEY) {
  console.error("[Error] Missing SERP_API_KEY in environment variables");
  process.exit(1);
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
      
      return {
        content: [
          { 
            type: "text", 
            text: `Found ${results.length} images for query "${query}":` 
          },
          {
            type: "text",
            text: JSON.stringify(results, null, 2)
          }
        ]
      };
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
      };
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