# Google Image Search MCP Server

This MCP (Model Context Protocol) server provides Google Image Search functionality through the SerpAPI. It allows AI assistants to search for images and analyze the results to find the most relevant ones based on specific criteria.

## Features

- Search for images with Google Image Search
- Download images to a local directory
- Analyze search results based on relevance criteria

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file with your SerpAPI key (you can copy from `.env.example`):

```
SERP_API_KEY=your_serp_api_key_here
```

You can get a SerpAPI key by signing up at [serpapi.com](https://serpapi.com/).

## Usage

### Building

```bash
npm run build
```

### Running

```bash
npm start
```

### Development

```bash
npm run dev
```

## Available Tools

### `search_images`

Search for images using Google Image Search.

**Parameters:**
- `query` (string): The search query for finding images
- `limit` (number, optional): Maximum number of results to return (default: 10)

### `download_image`

Download an image to a local directory.

**Parameters:**
- `imageUrl` (string): URL of the image to download
- `outputPath` (string): Directory path where the image should be saved
- `filename` (string): Filename for the downloaded image (including extension)

### `analyze_images`

Analyze image search results to find the most relevant ones.

**Parameters:**
- `searchResults` (array): Array of image search results to analyze
- `criteria` (string): Criteria for selecting the best images (e.g., 'professional', 'colorful', etc.)

## License

ISC