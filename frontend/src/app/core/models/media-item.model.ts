export interface MediaItem {
  id: number;
  type: 'movie' | 'tv_show' | 'episode';
  title: string;
  year?: number;
  duration?: number;
  file_path: string;
  file_size?: number;
  source_type?: 'local' | 'ftp' | 'smb' | 'upnp';
  tmdb_id?: number;
  poster_path?: string;
  backdrop_path?: string;
  poster_url?: string;
  backdrop_url?: string;
  overview?: string;
  rating?: number;
  vote_average?: number;
  genres?: string | string[];
  cast?: string | string[];
  director?: string;
  release_date?: string;
  runtime?: number;
  quality?: string;
  added_at?: string;
  updated_at?: string;
}

export interface MoviesResponse {
  movies: MediaItem[];
}
