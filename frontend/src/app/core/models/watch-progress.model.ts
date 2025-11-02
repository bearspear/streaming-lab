export interface WatchProgress {
  id: number;
  media_item_id: number;
  user_id: number;
  current_time: number;
  duration: number;
  progress: number;
  completed: boolean;
  watch_count: number;
  last_watched: string;
  title?: string;
  poster_path?: string;
}

export interface WatchProgressResponse {
  success: boolean;
  progress: WatchProgress;
}

export interface ContinueWatchingResponse {
  success: boolean;
  items: WatchProgress[];
}

export interface WatchStats {
  totalItems: number;
  completedItems: number;
  inProgressItems: number;
  totalWatches: number;
  totalWatchTime: number;
  totalWatchTimeFormatted: string;
  averageProgress: number;
}
