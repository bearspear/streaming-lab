import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MediaService } from '../../core/services/media.service';
import { WatchHistoryService } from '../../core/services/watch-history.service';
import { MediaItem } from '../../core/models/media-item.model';

@Component({
  selector: 'app-media-details',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './media-details.component.html',
  styleUrls: ['./media-details.component.scss']
})
export class MediaDetailsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private mediaService = inject(MediaService);
  private watchHistoryService = inject(WatchHistoryService);

  mediaId?: number;
  mediaItem?: MediaItem;
  isLoading = true;
  errorMessage = '';
  watchProgress = 0;

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.mediaId = +params['id'];
      if (this.mediaId) {
        this.loadMediaDetails();
        this.loadWatchProgress();
      }
    });
  }

  loadMediaDetails(): void {
    if (!this.mediaId) return;

    this.mediaService.getMediaItem(this.mediaId).subscribe({
      next: (media) => {
        this.mediaItem = media;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading media details:', error);
        this.errorMessage = 'Failed to load media details';
        this.isLoading = false;
      }
    });
  }

  loadWatchProgress(): void {
    if (!this.mediaId) return;

    this.watchHistoryService.getProgress(this.mediaId).subscribe({
      next: (response) => {
        this.watchProgress = response.progress?.progress || 0;
      },
      error: (error) => {
        console.log('No watch progress found');
      }
    });
  }

  getBackdropUrl(): string {
    if (!this.mediaItem) return '';
    return this.mediaService.getBackdropUrl(this.mediaItem.backdrop_path);
  }

  getPosterUrl(): string {
    if (!this.mediaItem) return '';
    return this.mediaService.getPosterUrl(this.mediaItem.poster_path);
  }

  getRating(): string {
    if (!this.mediaItem) return 'N/A';
    if (this.mediaItem.rating) {
      return this.mediaItem.rating.toFixed(1);
    }
    if (this.mediaItem.vote_average) {
      return this.mediaItem.vote_average.toFixed(1);
    }
    return 'N/A';
  }

  formatDuration(): string {
    if (!this.mediaItem) return '';

    const duration = this.mediaItem.duration || this.mediaItem.runtime;
    if (!duration) return '';

    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  getGenres(): string[] {
    if (!this.mediaItem || !this.mediaItem.genres) return [];

    // Handle both string and array formats
    if (typeof this.mediaItem.genres === 'string') {
      return this.mediaItem.genres.split(',').map(g => g.trim());
    }

    return this.mediaItem.genres;
  }

  getCast(): string[] {
    if (!this.mediaItem || !this.mediaItem.cast) return [];

    // Handle both string and array formats
    if (typeof this.mediaItem.cast === 'string') {
      return this.mediaItem.cast.split(',').map(c => c.trim()).slice(0, 5);
    }

    return this.mediaItem.cast.slice(0, 5);
  }

  playVideo(): void {
    if (this.mediaId) {
      this.router.navigate(['/watch', this.mediaId]);
    }
  }

  goBack(): void {
    this.router.navigate(['/library']);
  }
}
