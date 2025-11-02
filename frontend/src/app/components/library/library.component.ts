import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MediaService } from '../../core/services/media.service';
import { WatchHistoryService } from '../../core/services/watch-history.service';
import { AuthService } from '../../core/services/auth.service';
import { MediaItem } from '../../core/models/media-item.model';
import { WatchProgress } from '../../core/models/watch-progress.model';
import { TVShow } from '../../core/models/tv-show.model';
import { MediaCardComponent } from '../media-card/media-card.component';

@Component({
  selector: 'app-library',
  standalone: true,
  imports: [CommonModule, RouterModule, MediaCardComponent],
  templateUrl: './library.component.html',
  styleUrls: ['./library.component.scss']
})
export class LibraryComponent implements OnInit {
  private mediaService = inject(MediaService);
  private watchHistoryService = inject(WatchHistoryService);
  private authService = inject(AuthService);
  private router = inject(Router);

  mediaItems: MediaItem[] = [];
  tvShows: TVShow[] = [];
  continueWatching: WatchProgress[] = [];
  isLoading = true;
  errorMessage = '';
  activeTab: 'movies' | 'tv' = 'movies';

  currentUser$ = this.authService.currentUser$;

  ngOnInit(): void {
    this.loadMedia();
    this.loadTVShows();
    this.loadContinueWatching();
  }

  switchTab(tab: 'movies' | 'tv'): void {
    this.activeTab = tab;
  }

  loadMedia(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.mediaService.getMovies().subscribe({
      next: (response) => {
        this.mediaItems = response.movies || [];
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading media:', error);
        this.errorMessage = 'Failed to load media library. Please try again.';
        this.isLoading = false;
      }
    });
  }

  loadTVShows(): void {
    this.mediaService.getTVShows().subscribe({
      next: (response) => {
        this.tvShows = response.tvShows || [];
      },
      error: (error) => {
        console.error('Error loading TV shows:', error);
      }
    });
  }

  loadContinueWatching(): void {
    this.watchHistoryService.getContinueWatching(10).subscribe({
      next: (response) => {
        this.continueWatching = response.items || [];
      },
      error: (error) => {
        console.error('Error loading continue watching:', error);
      }
    });
  }

  getMediaById(id: number): MediaItem | undefined {
    return this.mediaItems.find(media => media.id === id);
  }

  getProgress(mediaId: number): number | undefined {
    const watchItem = this.continueWatching.find(item => item.media_item_id === mediaId);
    return watchItem?.progress;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
