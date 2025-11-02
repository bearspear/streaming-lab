import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MediaItem, MoviesResponse } from '../models/media-item.model';
import { TVShow, TVShowDetails, TVShowsResponse, Episode } from '../models/tv-show.model';

@Injectable({
  providedIn: 'root'
})
export class MediaService {
  private http = inject(HttpClient);

  getMovies(): Observable<MoviesResponse> {
    return this.http.get<MoviesResponse>(`${environment.apiUrl}/library/movies`)
      .pipe(
        catchError((error) => {
          console.error('Error fetching movies:', error);
          return throwError(() => error);
        })
      );
  }

  getMediaItem(id: number): Observable<MediaItem> {
    return this.http.get<MediaItem>(`${environment.apiUrl}/library/item/${id}`)
      .pipe(
        catchError((error) => {
          console.error('Error fetching media item:', error);
          return throwError(() => error);
        })
      );
  }

  searchMedia(query: string, type?: string, limit: number = 20): Observable<any> {
    let url = `${environment.apiUrl}/library/search?q=${encodeURIComponent(query)}&limit=${limit}`;
    if (type) {
      url += `&type=${type}`;
    }
    return this.http.get(url)
      .pipe(
        catchError((error) => {
          console.error('Error searching media:', error);
          return throwError(() => error);
        })
      );
  }

  getStreamUrl(id: number, quality?: string): string {
    const baseUrl = `${environment.apiUrl}/stream/${id}`;
    if (quality) {
      return `${baseUrl}/transcode?quality=${quality}`;
    }
    return `${baseUrl}/direct`;
  }

  getHLSUrl(id: number): string {
    // Remove /api from the URL for HLS streaming
    const baseUrl = environment.apiUrl.replace('/api', '');
    return `${baseUrl}/api/stream/${id}/hls/manifest.m3u8`;
  }

  getStreamInfo(id: number): Observable<any> {
    return this.http.get(`${environment.apiUrl}/stream/${id}/info`)
      .pipe(
        catchError((error) => {
          console.error('Error fetching stream info:', error);
          return throwError(() => error);
        })
      );
  }

  getAvailableQualities(id: number): Observable<any> {
    return this.http.get(`${environment.apiUrl}/stream/${id}/qualities`)
      .pipe(
        catchError((error) => {
          console.error('Error fetching qualities:', error);
          return throwError(() => error);
        })
      );
  }

  getPosterUrl(posterPath: string | undefined): string {
    if (!posterPath) {
      return 'assets/images/placeholder.svg';
    }

    // If it's already a full URL (from TMDB), return it
    if (posterPath.startsWith('http')) {
      return posterPath;
    }

    // Otherwise, it might be a local path
    return posterPath;
  }

  getBackdropUrl(backdropPath: string | undefined): string {
    if (!backdropPath) {
      return 'assets/images/placeholder.svg';
    }

    // If it's already a full URL (from TMDB), return it
    if (backdropPath.startsWith('http')) {
      return backdropPath;
    }

    // Otherwise, it might be a local path
    return backdropPath;
  }

  // TV Show methods
  getTVShows(): Observable<TVShowsResponse> {
    return this.http.get<TVShowsResponse>(`${environment.apiUrl}/library/tvshows`)
      .pipe(
        catchError((error) => {
          console.error('Error fetching TV shows:', error);
          return throwError(() => error);
        })
      );
  }

  getTVShowDetails(id: number): Observable<TVShowDetails> {
    return this.http.get<TVShowDetails>(`${environment.apiUrl}/library/tvshow/${id}`)
      .pipe(
        catchError((error) => {
          console.error('Error fetching TV show details:', error);
          return throwError(() => error);
        })
      );
  }

  getNextEpisode(episodeId: number): Observable<Episode> {
    return this.http.get<Episode>(`${environment.apiUrl}/library/episode/${episodeId}/next`)
      .pipe(
        catchError((error) => {
          console.error('Error fetching next episode:', error);
          return throwError(() => error);
        })
      );
  }

  getPreviousEpisode(episodeId: number): Observable<Episode> {
    return this.http.get<Episode>(`${environment.apiUrl}/library/episode/${episodeId}/previous`)
      .pipe(
        catchError((error) => {
          console.error('Error fetching previous episode:', error);
          return throwError(() => error);
        })
      );
  }

  // Subtitle methods
  getSubtitles(mediaId: number): Observable<any> {
    return this.http.get(`${environment.apiUrl}/subtitles/media/${mediaId}`)
      .pipe(
        catchError((error) => {
          console.error('Error fetching subtitles:', error);
          return throwError(() => error);
        })
      );
  }

  getSubtitleUrl(subtitleId: number): string {
    return `${environment.apiUrl}/subtitles/${subtitleId}`;
  }
}
