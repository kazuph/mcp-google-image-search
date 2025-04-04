# API Reference

## Tool: `search_images`

Search for images using Google Image Search via SerpAPI.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | The search query for finding images |
| `limit` | number | No | Maximum number of results to return (default: 10) |

### Response

Returns an array of image search results with the following properties:

```typescript
interface ImageSearchResult {
  position: number;    // Position in search results
  thumbnail: string;   // URL to thumbnail image
  source: string;      // Source website name
  title: string;       // Image title
  link: string;        // URL to the page containing the image
  original: string;    // URL to the original image
  is_product: boolean; // Whether the image is a product image
  size?: string;       // Size of the image as text (if available)
  width?: number;      // Width of the image in pixels (if available)
  height?: number;     // Height of the image in pixels (if available)
}
```

### Example Usage

```typescript
// Example input
{
  "query": "purple gradient ui badges",
  "limit": 5
}

// Example output
{
  "content": [
    {
      "type": "text",
      "text": "Found 5 images for query \"purple gradient ui badges\":"
    },
    {
      "type": "text",
      "text": "[{\"position\":1,\"thumbnail\":\"https://example.com/thumb1.jpg\",\"source\":\"ExampleSite\",\"title\":\"Purple UI Badge\",\"link\":\"https://example.com/page1\",\"original\":\"https://example.com/image1.jpg\",\"is_product\":false,\"width\":800,\"height\":600},{...}]"
    }
  ]
}
```

## Tool: `download_image`

Download an image to a local directory.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `imageUrl` | string | Yes | URL of the image to download |
| `outputPath` | string | Yes | Directory path where the image should be saved |
| `filename` | string | Yes | Filename for the downloaded image (including extension) |

### Response

Returns the full path to the downloaded image.

### Example Usage

```typescript
// Example input
{
  "imageUrl": "https://example.com/image.jpg",
  "outputPath": "/path/to/download/directory",
  "filename": "downloaded_image.jpg"
}

// Example output
{
  "content": [
    {
      "type": "text",
      "text": "Image successfully downloaded to: /path/to/download/directory/downloaded_image.jpg"
    }
  ]
}
```

## Tool: `analyze_images`

Analyze image search results to find the most relevant ones based on criteria.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `searchResults` | ImageSearchResult[] | Yes | Array of image search results to analyze |
| `criteria` | string | Yes | Criteria for selecting the best images (e.g., 'professional', 'colorful', etc.) |

### Response

Returns the input array of images with additional properties:

```typescript
interface AnalyzedImageResult extends ImageSearchResult {
  relevanceScore: number;       // Score from 1-10 indicating relevance
  recommendation: string;       // "Highly recommended", "Recommended", or "Standard option"
}
```

### Example Usage

```typescript
// Example input
{
  "searchResults": [
    {
      "position": 1,
      "thumbnail": "https://example.com/thumb1.jpg",
      "source": "ExampleSite",
      "title": "Purple UI Badge",
      "link": "https://example.com/page1",
      "original": "https://example.com/image1.jpg",
      "is_product": false,
      "width": 800,
      "height": 600
    },
    // More results...
  ],
  "criteria": "professional purple gradient"
}

// Example output
{
  "content": [
    {
      "type": "text",
      "text": "Analyzed 5 images based on criteria: \"professional purple gradient\""
    },
    {
      "type": "text",
      "text": "[{\"position\":1,\"thumbnail\":\"https://example.com/thumb1.jpg\",\"source\":\"ExampleSite\",\"title\":\"Purple UI Badge\",\"link\":\"https://example.com/page1\",\"original\":\"https://example.com/image1.jpg\",\"is_product\":false,\"width\":800,\"height\":600,\"relevanceScore\":7,\"recommendation\":\"Highly recommended\"},{...}]"
    }
  ]
}
```