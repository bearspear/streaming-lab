import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MediaItem } from '../../core/models/media-item.model';
import { MediaService } from '../../core/services/media.service';

@Component({
  selector: 'app-media-card',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './media-card.component.html',
  styleUrls: ['./media-card.component.scss']
})
export class MediaCardComponent {
  @Input() media!: MediaItem;
  @Input() progress?: number;

  constructor(private mediaService: MediaService) {}

  getPosterUrl(): string {
    return this.mediaService.getPosterUrl(this.media.poster_path);
  }

  getYear(): string {
    if (this.media.year) {
      return this.media.year.toString();
    }
    if (this.media.release_date) {
      return new Date(this.media.release_date).getFullYear().toString();
    }
    return '';
  }

  getRating(): string {
    if (this.media.rating) {
      return this.media.rating.toFixed(1);
    }
    if (this.media.vote_average) {
      return this.media.vote_average.toFixed(1);
    }
    return 'N/A';
  }

  formatDuration(): string {
    if (!this.media.duration) return '';

    const hours = Math.floor(this.media.duration / 3600);
    const minutes = Math.floor((this.media.duration % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }
}
