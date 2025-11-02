export interface TVShow {
  id: number;
  title: string;
  overview?: string;
  poster_url?: string;
  backdrop_url?: string;
  rating?: number;
  number_of_seasons?: number;
  number_of_episodes?: number;
  status?: string;
  genres?: string[];
  added_at: string;
}

export interface Episode {
  id: number;
  season_number: number;
  episode_number: number;
  title: string;
  overview?: string;
  air_date?: string;
  still_path?: string;
  media_item_id: number;
  duration?: number;
  file_path: string;
}

export interface Season {
  seasonNumber: number;
  episodes: Episode[];
}

export interface TVShowDetails extends TVShow {
  seasons: Season[];
  totalEpisodes: number;
}

export interface TVShowsResponse {
  count: number;
  tvShows: TVShow[];
}
