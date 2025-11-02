import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface DashboardStats {
  stats: {
    totalUsers: number;
    totalMovies: number;
    totalTVShows: number;
    totalEpisodes: number;
    totalStorage: number;
  };
  recentlyAdded: any[];
  mostWatched: any[];
}

export interface UserWithStats {
  id: number;
  username: string;
  is_admin: boolean;
  created_at: string;
  watchCount: number;
}

export interface LibraryStats {
  mediaByType: {
    movies: number;
    tvShows: number;
    episodes: number;
  };
  metadata: {
    withMetadata: number;
    withoutMetadata: number;
  };
  missingFiles: any[];
}

export interface MediaPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface MediaResponse {
  media: any[];
  pagination: MediaPagination;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private http = inject(HttpClient);

  getDashboardStats(): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(`${environment.apiUrl}/admin/dashboard`);
  }

  getUsers(): Observable<{ users: UserWithStats[] }> {
    return this.http.get<{ users: UserWithStats[] }>(`${environment.apiUrl}/admin/users`);
  }

  deleteUser(userId: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${environment.apiUrl}/admin/users/${userId}`);
  }

  toggleAdminStatus(userId: number): Observable<{ message: string; isAdmin: boolean }> {
    return this.http.put<{ message: string; isAdmin: boolean }>(
      `${environment.apiUrl}/admin/users/${userId}/admin`,
      {}
    );
  }

  getLibraryStats(): Observable<LibraryStats> {
    return this.http.get<LibraryStats>(`${environment.apiUrl}/admin/library/stats`);
  }

  getAllMedia(page: number = 1, limit: number = 50, type?: string, search?: string): Observable<MediaResponse> {
    let params: any = { page, limit };
    if (type && type !== 'all') params.type = type;
    if (search) params.search = search;

    return this.http.get<MediaResponse>(`${environment.apiUrl}/admin/media`, { params });
  }

  deleteMediaItem(mediaId: number, deleteFile: boolean = false): Observable<{ message: string; deletedFile: boolean }> {
    return this.http.delete<{ message: string; deletedFile: boolean }>(
      `${environment.apiUrl}/admin/media/${mediaId}`,
      { body: { deleteFile } }
    );
  }
}
