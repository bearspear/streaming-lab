import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { WatchProgress, WatchProgressResponse, ContinueWatchingResponse, WatchStats } from '../models/watch-progress.model';

@Injectable({
  providedIn: 'root'
})
export class WatchHistoryService {
  private http = inject(HttpClient);

  updateProgress(mediaItemId: number, currentTime: number, duration: number): Observable<WatchProgressResponse> {
    return this.http.post<WatchProgressResponse>(`${environment.apiUrl}/metadata/watch/progress`, {
      mediaItemId,
      currentTime,
      duration
    }).pipe(
      catchError((error) => {
        console.error('Error updating progress:', error);
        return throwError(() => error);
      })
    );
  }

  getProgress(mediaItemId: number): Observable<WatchProgressResponse> {
    return this.http.get<WatchProgressResponse>(`${environment.apiUrl}/metadata/watch/progress/${mediaItemId}`)
      .pipe(
        catchError((error) => {
          console.error('Error getting progress:', error);
          return throwError(() => error);
        })
      );
  }

  getContinueWatching(limit: number = 10): Observable<ContinueWatchingResponse> {
    return this.http.get<ContinueWatchingResponse>(`${environment.apiUrl}/metadata/watch/continue-watching?limit=${limit}`)
      .pipe(
        catchError((error) => {
          console.error('Error getting continue watching:', error);
          return throwError(() => error);
        })
      );
  }

  getRecentlyWatched(limit: number = 20): Observable<ContinueWatchingResponse> {
    return this.http.get<ContinueWatchingResponse>(`${environment.apiUrl}/metadata/watch/recently-watched?limit=${limit}`)
      .pipe(
        catchError((error) => {
          console.error('Error getting recently watched:', error);
          return throwError(() => error);
        })
      );
  }

  getWatchHistory(limit: number = 50, offset: number = 0): Observable<ContinueWatchingResponse> {
    return this.http.get<ContinueWatchingResponse>(
      `${environment.apiUrl}/metadata/watch/history?limit=${limit}&offset=${offset}`
    ).pipe(
      catchError((error) => {
        console.error('Error getting watch history:', error);
        return throwError(() => error);
      })
    );
  }

  getWatchStats(): Observable<{ success: boolean; stats: WatchStats }> {
    return this.http.get<{ success: boolean; stats: WatchStats }>(`${environment.apiUrl}/metadata/watch/stats`)
      .pipe(
        catchError((error) => {
          console.error('Error getting watch stats:', error);
          return throwError(() => error);
        })
      );
  }

  markAsWatched(mediaItemId: number): Observable<any> {
    return this.http.post(`${environment.apiUrl}/metadata/watch/mark-watched/${mediaItemId}`, {})
      .pipe(
        catchError((error) => {
          console.error('Error marking as watched:', error);
          return throwError(() => error);
        })
      );
  }

  markAsUnwatched(mediaItemId: number): Observable<any> {
    return this.http.delete(`${environment.apiUrl}/metadata/watch/mark-unwatched/${mediaItemId}`)
      .pipe(
        catchError((error) => {
          console.error('Error marking as unwatched:', error);
          return throwError(() => error);
        })
      );
  }

  resetProgress(mediaItemId: number): Observable<any> {
    return this.http.post(`${environment.apiUrl}/metadata/watch/reset/${mediaItemId}`, {})
      .pipe(
        catchError((error) => {
          console.error('Error resetting progress:', error);
          return throwError(() => error);
        })
      );
  }

  formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }
}
