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