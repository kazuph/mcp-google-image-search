# Google Image Search MCP Server

A Model Context Protocol (MCP) server that provides Google Image search functionality with support for both Google Custom Search API and SerpAPI, including automatic fallback and rate limit handling.

## Features

- 🔍 **Image Search**: Search for images using Google Image Search
- 📥 **Image Download**: Download images to local directories with security validation
- 📊 **Image Analysis**: Analyze search results and rank them by relevance
- 🔄 **Automatic API Switching**: Seamlessly switches between Google Custom Search API and SerpAPI when rate limits are hit
- 🛡️ **Security**: Built-in protections against SSRF, path traversal, and command injection attacks
- 🖼️ **Resource Display**: Images are displayed directly in Claude Desktop as MCP resources

## Installation

```bash
npm install -g @kazuph/mcp-google-image-search
```

## API Configuration

This server supports two APIs with automatic fallback:

### 1. Google Custom Search API (Default, Recommended)

**Advantages:**
- Free tier: 100 queries/day
- Cost-effective: $5 per 1,000 additional queries
- Official Google API

#### Setup Instructions:

1. **Get Google API Key:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing
   - Navigate to "APIs & Services" → "Library"
   - Search and enable "Custom Search API"
   - Go to "Credentials" → "Create Credentials" → "API Key"
   - Copy your API key

2. **Create Custom Search Engine:**
   - Visit [Google Custom Search Engine](https://cse.google.com/)
   - Click "New search engine"
   - Enter `*` in "Sites to search" (to search the entire web)
   - Click "Create"
   - In the control panel, copy your "Search engine ID"
   - Enable "Image search" in settings

3. **Configure Environment Variables:**
   ```bash
   export GOOGLE_API_KEY="your-google-api-key"
   export GOOGLE_CSE_ID="your-custom-search-engine-id"
   ```

### 2. SerpAPI (Fallback)

**Advantages:**
- More structured data
- Faster initial setup
- No custom search engine creation required

#### Setup Instructions:

1. Sign up at [SerpAPI](https://serpapi.com/)
2. Get your API key from the dashboard
3. Configure environment variable:
   ```bash
   export SERP_API_KEY="your-serp-api-key"
   ```

## Claude Desktop Configuration

Add this to your Claude Desktop config file (`~/Library/Application Support/Claude/claude_desktop_config.json`):

### Using Google Custom Search API Only:
```json
{
  "mcpServers": {
    "google-image-search": {
      "command": "node",
      "args": ["/path/to/node_modules/@kazuph/mcp-google-image-search/dist/index.js"],
      "env": {
        "GOOGLE_API_KEY": "your-google-api-key",
        "GOOGLE_CSE_ID": "your-custom-search-engine-id"
      }
    }
  }
}
```

### Using Both APIs with Automatic Fallback:
```json
{
  "mcpServers": {
    "google-image-search": {
      "command": "node", 
      "args": ["/path/to/node_modules/@kazuph/mcp-google-image-search/dist/index.js"],
      "env": {
        "GOOGLE_API_KEY": "your-google-api-key",
        "GOOGLE_CSE_ID": "your-custom-search-engine-id",
        "SERP_API_KEY": "your-serp-api-key"
      }
    }
  }
}
```

### Using SerpAPI Only:
```json
{
  "mcpServers": {
    "google-image-search": {
      "command": "node",
      "args": ["/path/to/node_modules/@kazuph/mcp-google-image-search/dist/index.js"], 
      "env": {
        "SERP_API_KEY": "your-serp-api-key"
      }
    }
  }
}
```

After updating the configuration, restart Claude Desktop.

## Available Tools

### `search_images`
Search for images using Google Image Search.

**Parameters:**
- `query` (string): The search query for finding images
- `limit` (number, optional): Maximum number of results to return (default: 10)

**Returns:** Array of image results with resource URIs for direct viewing in Claude Desktop.

### `download_image`  
Download an image to a local directory.

**Parameters:**
- `imageUrl` (string): URL of the image to download
- `outputPath` (string): Directory path where the image should be saved
- `filename` (string): Filename for the downloaded image (including extension)

**Returns:** Path to the downloaded file.

### `analyze_images`
Analyze image search results to find the most relevant ones based on criteria.

**Parameters:**
- `searchResults` (array): Array of image search results to analyze  
- `criteria` (string): Criteria for selecting the best images (e.g., 'professional', 'colorful', etc.)

**Returns:** Analyzed results with relevance scores and recommendations.

## Security Features

This MCP server includes comprehensive security protections:

- **SSRF Prevention**: Blocks requests to internal network addresses
- **Path Traversal Protection**: Sanitizes file paths to prevent directory traversal attacks  
- **Command Injection Prevention**: Uses secure HTTP client instead of shell commands
- **URL Validation**: Validates URLs and blocks unsafe protocols
- **File Type Validation**: Ensures downloaded content is actually image data

## Rate Limiting & API Switching

The server automatically handles rate limits:

1. **Primary Provider**: Starts with Google Custom Search API (if configured)
2. **Automatic Fallback**: Switches to SerpAPI when rate limits are detected
3. **Persistent State**: Maintains the switched state until server restart
4. **Error Detection**: Recognizes various rate limit error patterns from both APIs

## Development

```bash
# Clone the repository
git clone https://github.com/kazuph/mcp-google-image-search.git
cd mcp-google-image-search

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Start in development mode
npm run dev
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

ISC License - see [LICENSE](LICENSE) file for details.

## Changelog

### 1.0.0
- Initial release
- Google Custom Search API support
- SerpAPI support  
- Automatic API switching and rate limit handling
- Security vulnerability fixes
- MCP resource support for image display
- Comprehensive test suite