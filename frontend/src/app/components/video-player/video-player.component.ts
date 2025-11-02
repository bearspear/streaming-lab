import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, inject, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import videojs from 'video.js';
import Player from 'video.js/dist/types/player';
import { MediaService } from '../../core/services/media.service';
import { WatchHistoryService } from '../../core/services/watch-history.service';
import { MediaItem } from '../../core/models/media-item.model';
import { Episode } from '../../core/models/tv-show.model';

@Component({
  selector: 'app-video-player',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './video-player.component.html',
  styleUrls: ['./video-player.component.scss']
})
export class VideoPlayerComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('videoPlayer', { static: false }) videoPlayerRef!: ElementRef<HTMLVideoElement>;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private mediaService = inject(MediaService);
  private watchHistoryService = inject(WatchHistoryService);
  private ngZone = inject(NgZone);

  player?: Player;
  mediaId?: number;
  mediaItem?: MediaItem;
  isLoading = true;
  errorMessage = '';

  availableQualities: any[] = [];
  currentQuality = 'auto';

  // Subtitles
  availableSubtitles: any[] = [];

  // Episode navigation
  nextEpisode?: Episode;
  previousEpisode?: Episode;
  isEpisode = false;

  private progressInterval?: any;
  private lastSavedTime = 0;
  private startTimeToResume = 0;
  private viewInitialized = false;

  ngOnInit(): void {
    console.log('[VideoPlayer] ngOnInit called');
    // Get media ID from route
    this.route.params.subscribe(params => {
      console.log('[VideoPlayer] Route params:', params);
      this.mediaId = +params['id'];
      console.log('[VideoPlayer] Extracted mediaId:', this.mediaId);
      if (this.mediaId) {
        console.log('[VideoPlayer] Calling loadMediaInfo()');
        this.loadMediaInfo();
      } else {
        console.error('[VideoPlayer] No mediaId found in route params');
        this.errorMessage = 'Invalid media ID';
        this.isLoading = false;
      }
    });
  }

  ngAfterViewInit(): void {
    this.viewInitialized = true;
    // Initialize player if we have the data ready
    if (this.mediaItem && this.videoPlayerRef) {
      this.initializePlayer(this.startTimeToResume);
    }
  }

  ngOnDestroy(): void {
    // Clean up
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
    }

    if (this.player) {
      // Save progress one last time before destroying
      this.saveProgress();
      this.player.dispose();
    }
  }

  loadMediaInfo(): void {
    console.log('[VideoPlayer] loadMediaInfo called, mediaId:', this.mediaId);
    if (!this.mediaId) {
      console.error('[VideoPlayer] loadMediaInfo: mediaId is undefined');
      return;
    }

    console.log('[VideoPlayer] Fetching media item from API...');
    this.mediaService.getMediaItem(this.mediaId).subscribe({
      next: (media) => {
        console.log('[VideoPlayer] Media item loaded:', media);
        this.mediaItem = media;
        this.isEpisode = media.type === 'episode';

        // Load episode navigation if this is an episode
        if (this.isEpisode) {
          this.loadEpisodeNavigation();
        }

        this.loadAvailableQualities();
        this.loadSubtitles();
        this.loadLastWatchedPosition();
      },
      error: (error) => {
        console.error('[VideoPlayer] Error loading media:', error);
        this.errorMessage = 'Failed to load media information';
        this.isLoading = false;
      }
    });
  }

  loadEpisodeNavigation(): void {
    if (!this.mediaId) return;

    // Load next episode
    this.mediaService.getNextEpisode(this.mediaId).subscribe({
      next: (episode) => {
        this.nextEpisode = episode;
        console.log('[VideoPlayer] Next episode loaded:', episode);
      },
      error: (error) => {
        console.log('[VideoPlayer] No next episode available');
        this.nextEpisode = undefined;
      }
    });

    // Load previous episode
    this.mediaService.getPreviousEpisode(this.mediaId).subscribe({
      next: (episode) => {
        this.previousEpisode = episode;
        console.log('[VideoPlayer] Previous episode loaded:', episode);
      },
      error: (error) => {
        console.log('[VideoPlayer] No previous episode available');
        this.previousEpisode = undefined;
      }
    });
  }

  loadAvailableQualities(): void {
    if (!this.mediaId) return;

    this.mediaService.getAvailableQualities(this.mediaId).subscribe({
      next: (response) => {
        this.availableQualities = response.qualities || [];
      },
      error: (error) => {
        console.error('Error loading qualities:', error);
        // Continue anyway with HLS auto quality
      }
    });
  }

  loadSubtitles(): void {
    if (!this.mediaId) return;

    this.mediaService.getSubtitles(this.mediaId).subscribe({
      next: (response) => {
        this.availableSubtitles = response.subtitles || [];
        console.log('[VideoPlayer] Subtitles loaded:', this.availableSubtitles);
        // If player is already initialized, add subtitles to it
        if (this.player) {
          this.addSubtitlesToPlayer();
        }
      },
      error: (error) => {
        console.error('Error loading subtitles:', error);
        this.availableSubtitles = [];
      }
    });
  }

  loadLastWatchedPosition(): void {
    if (!this.mediaId) return;

    this.watchHistoryService.getProgress(this.mediaId).subscribe({
      next: (response) => {
        this.startTimeToResume = response.progress?.current_time || 0;
        // Initialize player if view is ready
        if (this.viewInitialized && this.videoPlayerRef) {
          this.initializePlayer(this.startTimeToResume);
        }
      },
      error: (error) => {
        console.error('Error loading watch progress:', error);
        this.startTimeToResume = 0;
        // Initialize player if view is ready
        if (this.viewInitialized && this.videoPlayerRef) {
          this.initializePlayer(0);
        }
      }
    });
  }

  initializePlayer(startTime: number = 0): void {
    if (!this.mediaId || !this.videoPlayerRef) {
      console.warn('Cannot initialize player: mediaId or videoPlayerRef missing');
      return;
    }

    // Get JWT token and append to stream URL as query parameter
    const token = localStorage.getItem('token');
    // Use direct streaming instead of HLS (HLS transcoding takes too long)
    let streamUrl = this.mediaService.getStreamUrl(this.mediaId);
    if (token) {
      streamUrl += `?token=${encodeURIComponent(token)}`;
    }

    // Determine MIME type from file extension
    const fileExt = this.mediaItem?.file_path?.toLowerCase().split('.').pop() || 'mp4';
    const mimeTypes: { [key: string]: string } = {
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'mkv': 'video/x-matroska',
      'avi': 'video/x-msvideo',
      'mov': 'video/quicktime'
    };
    const mimeType = mimeTypes[fileExt] || 'video/mp4';

    // Create and append <source> element BEFORE Video.js initialization
    const videoEl = this.videoPlayerRef.nativeElement;
    const sourceEl = document.createElement('source');
    sourceEl.src = streamUrl;
    sourceEl.type = mimeType;
    videoEl.appendChild(sourceEl);

    console.log('[VideoPlayer] Added source element:', {
      src: sourceEl.src,
      type: sourceEl.type,
      fileExt,
      mimeType
    });

    // Initialize Video.js player
    this.player = videojs(this.videoPlayerRef.nativeElement, {
      controls: true,
      autoplay: false,
      preload: 'auto',
      fluid: true,
      responsive: true,
      playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2],
      controlBar: {
        children: [
          'playToggle',
          'volumePanel',
          'currentTimeDisplay',
          'timeDivider',
          'durationDisplay',
          'progressControl',
          'liveDisplay',
          'seekToLive',
          'remainingTimeDisplay',
          'customControlSpacer',
          'playbackRateMenuButton',
          'chaptersButton',
          'descriptionsButton',
          'subsCapsButton',
          'audioTrackButton',
          'qualitySelector',
          'fullscreenToggle'
        ]
      },
      html5: {
        vhs: {
          overrideNative: true,
          withCredentials: false
        },
        nativeVideoTracks: false,
        nativeAudioTracks: false,
        nativeTextTracks: false
      }
    });

    // Source already set on native element before Video.js initialization
    // No need to call this.player.src() again

    // Set starting position if resuming
    if (startTime > 0) {
      this.player.currentTime(startTime);
    }

    // Add subtitles to player if available
    if (this.availableSubtitles.length > 0) {
      this.addSubtitlesToPlayer();
    }

    // Handle player events - wrap in ngZone.run() to trigger Angular change detection
    this.player.on('loadedmetadata', () => {
      this.ngZone.run(() => {
        this.isLoading = false;
        console.log('[VideoPlayer] Video metadata loaded, isLoading set to false');
      });
    });

    this.player.on('error', (error: any) => {
      this.ngZone.run(() => {
        console.error('Video player error:', error);
        this.errorMessage = 'Error loading video. Please try again.';
        this.isLoading = false;
      });
    });

    this.player.on('play', () => {
      this.ngZone.run(() => {
        console.log('Video playing');
        this.startProgressTracking();
      });
    });

    this.player.on('pause', () => {
      this.ngZone.run(() => {
        console.log('Video paused');
        this.saveProgress();
      });
    });

    this.player.on('ended', () => {
      this.ngZone.run(() => {
        console.log('Video ended');
        this.markAsWatched();
      });
    });

    // Handle keyboard shortcuts
    this.setupKeyboardShortcuts();
  }

  setupKeyboardShortcuts(): void {
    if (!this.player) return;

    // Space bar: play/pause
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        if (this.player?.paused()) {
          this.player.play();
        } else {
          this.player?.pause();
        }
      }

      // Arrow keys: seek
      if (e.code === 'ArrowRight') {
        e.preventDefault();
        const currentTime = this.player?.currentTime() || 0;
        this.player?.currentTime(currentTime + 10);
      }

      if (e.code === 'ArrowLeft') {
        e.preventDefault();
        const currentTime = this.player?.currentTime() || 0;
        this.player?.currentTime(Math.max(0, currentTime - 10));
      }

      // F key: fullscreen
      if (e.code === 'KeyF') {
        e.preventDefault();
        if (this.player?.isFullscreen()) {
          this.player.exitFullscreen();
        } else {
          this.player?.requestFullscreen();
        }
      }

      // Escape: exit fullscreen or go back
      if (e.code === 'Escape' && !this.player?.isFullscreen()) {
        this.goBack();
      }
    });
  }

  startProgressTracking(): void {
    // Clear any existing interval
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
    }

    // Save progress every 10 seconds
    this.progressInterval = setInterval(() => {
      this.saveProgress();
    }, 10000);
  }

  saveProgress(): void {
    if (!this.player || !this.mediaId) return;

    const currentTime = this.player.currentTime() || 0;
    const duration = this.player.duration() || 0;

    // Only save if time has changed significantly (at least 1 second)
    if (Math.abs(currentTime - this.lastSavedTime) < 1) {
      return;
    }

    this.lastSavedTime = currentTime;

    this.watchHistoryService.updateProgress(this.mediaId, currentTime, duration).subscribe({
      next: () => {
        console.log('Progress saved:', currentTime);
      },
      error: (error) => {
        console.error('Error saving progress:', error);
      }
    });
  }

  markAsWatched(): void {
    if (!this.mediaId) return;

    this.watchHistoryService.markAsWatched(this.mediaId).subscribe({
      next: () => {
        console.log('Marked as watched');
      },
      error: (error) => {
        console.error('Error marking as watched:', error);
      }
    });
  }

  changeQuality(quality: string): void {
    if (!this.player || !this.mediaId) return;

    this.currentQuality = quality;
    const currentTime = this.player.currentTime();
    const wasPaused = this.player.paused();

    let url: string;
    if (quality === 'auto') {
      url = this.mediaService.getHLSUrl(this.mediaId);
    } else {
      url = this.mediaService.getStreamUrl(this.mediaId, quality);
    }

    this.player.src({
      src: url,
      type: quality === 'auto' ? 'application/x-mpegURL' : 'video/mp4'
    });

    this.player.currentTime(currentTime);

    if (!wasPaused) {
      this.player.play();
    }
  }

  goBack(): void {
    this.router.navigate(['/library']);
  }

  playNextEpisode(): void {
    if (this.nextEpisode?.media_item_id) {
      // Save progress before navigating
      this.saveProgress();
      // Navigate to next episode
      this.router.navigate(['/watch', this.nextEpisode.media_item_id]);
    }
  }

  playPreviousEpisode(): void {
    if (this.previousEpisode?.media_item_id) {
      // Save progress before navigating
      this.saveProgress();
      // Navigate to previous episode
      this.router.navigate(['/watch', this.previousEpisode.media_item_id]);
    }
  }

  addSubtitlesToPlayer(): void {
    if (!this.player || !this.availableSubtitles.length) {
      return;
    }

    console.log('[VideoPlayer] Adding subtitles to player:', this.availableSubtitles);

    // Get JWT token for authenticated subtitle requests
    const token = localStorage.getItem('token');

    this.availableSubtitles.forEach((subtitle, index) => {
      let subtitleUrl = this.mediaService.getSubtitleUrl(subtitle.id);
      if (token) {
        subtitleUrl += `?token=${encodeURIComponent(token)}`;
      }

      // Determine kind based on format or default to 'subtitles'
      const kind = 'subtitles';

      // Add text track to player
      this.player?.addRemoteTextTrack({
        kind: kind,
        src: subtitleUrl,
        srclang: subtitle.language,
        label: subtitle.label,
        default: subtitle.is_default || index === 0
      }, false);

      console.log(`[VideoPlayer] Added subtitle track: ${subtitle.label} (${subtitle.language})`);
    });
  }
}
