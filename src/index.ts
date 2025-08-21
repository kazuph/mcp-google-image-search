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

// Store registered resource names for cleanup
const registeredImageResources = new Set<string>();

// Generate unique resource ID for each search
function generateSearchId(): string {
  return `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Helper function to generate resource name for an image
function generateImageResourceName(searchId: string, imageIndex: number): string {
  return `image_${searchId}_${imageIndex}`;
}

// Helper function to clean up old image resources
function cleanupOldImageResources() {
  // Clean up resources older than 1 hour
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  
  for (const resourceName of registeredImageResources) {
    // Extract timestamp from resource name pattern: image_search_TIMESTAMP_RANDOM_INDEX
    const match = resourceName.match(/^image_search_(\d+)_/);
    if (match) {
      const timestamp = parseInt(match[1], 10);
      if (timestamp < oneHourAgo) {
        try {
          // Remove from MCP server (if such method exists)
          registeredImageResources.delete(resourceName);
          console.error(`[Cleanup] Removed old resource: ${resourceName}`);
        } catch (error) {
          console.error(`[Cleanup] Error removing resource ${resourceName}:`, error);
        }
      }
    }
  }
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
      
      // Clean up old resources before registering new ones
      cleanupOldImageResources();
      
      // Register each image as a separate MCP resource
      const resourceLinks = results.map((image, index) => {
        const resourceName = generateImageResourceName(searchId, index);
        const resourceUri = `image://${searchId}/${index}`;
        
        // Register this specific image as a resource
        server.registerResource(
          resourceName,
          resourceUri,
          {
            title: `${image.title} (Image ${index + 1})`,
            description: `Image from ${image.source}: ${image.title}`,
            mimeType: 'image/jpeg' // Will be determined dynamically in handler
          },
          async () => {
            try {
              console.error(`[Resource] Fetching image ${index} from: ${image.original}`);
              const { data, mimeType } = await fetchImageAsBase64(image.original);
              console.error(`[Resource] Image ${index} fetched successfully, mimeType: ${mimeType}, data length: ${data.length}`);
              
              return {
                contents: [{
                  uri: resourceUri,
                  blob: data,
                  mimeType: mimeType
                }]
              };
            } catch (error: any) {
              console.error(`[Error] Failed to fetch image ${index}:`, error);
              throw error;
            }
          }
        );
        
        // Track registered resource for cleanup
        registeredImageResources.add(resourceName);
        
        // Return resource link for the tool response
        return {
          type: "resource_link",
          uri: resourceUri,
          name: `${image.title} (Image ${index + 1})`,
          description: `Image from ${image.source}`,
          mimeType: 'image/jpeg'
        };
      });
      
      // Add resource URIs to each image for backward compatibility
      const resultsWithResources = results.map((image, index) => ({
        ...image,
        resourceUri: `image://${searchId}/${index}`,
        resourceName: generateImageResourceName(searchId, index),
        index: index
      }));
      
      // Create content with resource links
      const content = [
        { 
          type: "text", 
          text: `Found ${results.length} images for query "${query}". Each image is now available as a separate resource:` 
        },
        ...resourceLinks,
        {
          type: "text",
          text: `\n✅ All ${results.length} images have been registered as individual MCP resources and should appear in your Claude Desktop resources panel.`
        }
      ];
      
      console.error(`[Tool] Registered ${results.length} image resources for search ID: ${searchId}`);
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

// Set up periodic cleanup of old image resources
setInterval(() => {
  cleanupOldImageResources();
}, 15 * 60 * 1000); // Clean up every 15 minutes

console.error("[Setup] Image resource cleanup scheduled every 15 minutes");

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