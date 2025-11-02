import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  NetworkSource,
  BrowseResult,
  UPnPDevice,
  ConnectionTestResult
} from '../models/network.model';

@Injectable({
  providedIn: 'root'
})
export class NetworkService {
  private apiUrl = `${environment.apiUrl}/network`;

  constructor(private http: HttpClient) {}

  // Network Source Management
  getNetworkSources(): Observable<{ count: number; sources: NetworkSource[] }> {
    return this.http.get<{ count: number; sources: NetworkSource[] }>(`${this.apiUrl}/sources`);
  }

  getNetworkSource(id: number): Observable<NetworkSource> {
    return this.http.get<NetworkSource>(`${this.apiUrl}/sources/${id}`);
  }

  createNetworkSource(source: Partial<NetworkSource>): Observable<NetworkSource> {
    return this.http.post<NetworkSource>(`${this.apiUrl}/sources`, source);
  }

  updateNetworkSource(id: number, source: Partial<NetworkSource>): Observable<NetworkSource> {
    return this.http.put<NetworkSource>(`${this.apiUrl}/sources/${id}`, source);
  }

  deleteNetworkSource(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/sources/${id}`);
  }

  // Network Source Operations
  testConnection(id: number): Observable<ConnectionTestResult> {
    return this.http.post<ConnectionTestResult>(`${this.apiUrl}/sources/${id}/test`, {});
  }

  browseDirectory(id: number, path: string = '/'): Observable<BrowseResult> {
    const params = new HttpParams().set('path', path);
    return this.http.get<BrowseResult>(`${this.apiUrl}/sources/${id}/browse`, { params });
  }

  // UPnP Discovery
  discoverUPnP(timeout: number = 5000): Observable<{ count: number; devices: UPnPDevice[] }> {
    const params = new HttpParams().set('timeout', timeout.toString());
    return this.http.post<{ count: number; devices: UPnPDevice[] }>(`${this.apiUrl}/discover`, {}, { params });
  }

  getMediaServers(): Observable<{ count: number; servers: UPnPDevice[] }> {
    return this.http.get<{ count: number; servers: UPnPDevice[] }>(`${this.apiUrl}/media-servers`);
  }
}
