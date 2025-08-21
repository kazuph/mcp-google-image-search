// Types for Google Image Search API responses
export interface ImageSearchResult {
  position: number;
  thumbnail: string;
  source: string;
  title: string;
  link: string;
  original: string;
  is_product: boolean;
  size?: string;
  width?: number;
  height?: number;
  relevanceScore?: number;
  recommendation?: string;
}

export interface SearchResponse {
  search_metadata: {
    id: string;
    status: string;
    json_endpoint: string;
    created_at: string;
    processed_at: string;
    google_images_url: string;
    raw_html_file: string;
    total_time_taken: number;
  };
  search_parameters: {
    engine: string;
    q: string;
    google_domain: string;
    ijn: string;
    device: string;
  };
  search_information: {
    image_results_state: string;
    query_displayed: string;
    menu_items: Array<{
      position: number;
      title: string;
      link: string;
      serpapi_link: string;
    }>;
  };
  images_results: ImageSearchResult[];
}

// Google Custom Search API types
export interface GoogleImageItem {
  title: string;
  link: string;
  displayLink: string;
  snippet: string;
  mime: string;
  fileFormat: string;
  image: {
    contextLink: string;
    height: number;
    width: number;
    byteSize: number;
    thumbnailLink: string;
    thumbnailHeight: number;
    thumbnailWidth: number;
  };
}

export interface GoogleSearchResponse {
  kind: string;
  url: {
    type: string;
    template: string;
  };
  queries: {
    request: Array<{
      title: string;
      totalResults: string;
      searchTerms: string;
      count: number;
      startIndex: number;
      inputEncoding: string;
      outputEncoding: string;
      safe: string;
      cx: string;
      searchType: string;
    }>;
  };
  context: {
    title: string;
  };
  searchInformation: {
    searchTime: number;
    formattedSearchTime: string;
    totalResults: string;
    formattedTotalResults: string;
  };
  items: GoogleImageItem[];
}