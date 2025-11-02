import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MediaService } from '../../core/services/media.service';
import { TVShowDetails, Season, Episode } from '../../core/models/tv-show.model';

@Component({
  selector: 'app-tv-show-details',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './tv-show-details.component.html',
  styleUrl: './tv-show-details.component.scss'
})
export class TvShowDetailsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private mediaService = inject(MediaService);

  tvShow: TVShowDetails | null = null;
  selectedSeason: Season | null = null;
  loading = true;
  error: string | null = null;

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadTVShowDetails(parseInt(id, 10));
    }
  }

  loadTVShowDetails(id: number) {
    this.loading = true;
    this.error = null;

    this.mediaService.getTVShowDetails(id).subscribe({
      next: (data) => {
        this.tvShow = data;
        // Select first season by default
        if (data.seasons && data.seasons.length > 0) {
          this.selectedSeason = data.seasons[0];
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading TV show details:', err);
        this.error = 'Failed to load TV show details';
        this.loading = false;
      }
    });
  }

  selectSeason(season: Season) {
    this.selectedSeason = season;
  }

  playEpisode(episode: Episode) {
    this.router.navigate(['/watch', episode.media_item_id]);
  }

  getPosterUrl(posterPath: string | undefined): string {
    return this.mediaService.getPosterUrl(posterPath);
  }

  getBackdropUrl(backdropPath: string | undefined): string {
    return this.mediaService.getBackdropUrl(backdropPath);
  }

  goBack() {
    this.router.navigate(['/library']);
  }

  formatDuration(seconds: number): string {
    if (!seconds) return '';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }
}
