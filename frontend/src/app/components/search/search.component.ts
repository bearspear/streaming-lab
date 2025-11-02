import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { MediaService } from '../../core/services/media.service';
import { MediaItem } from '../../core/models/media-item.model';
import { MediaCardComponent } from '../media-card/media-card.component';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MediaCardComponent],
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss']
})
export class SearchComponent implements OnInit, OnDestroy {
  private mediaService = inject(MediaService);
  private router = inject(Router);

  searchQuery = '';
  searchResults: MediaItem[] = [];
  isSearching = false;
  hasSearched = false;
  errorMessage = '';

  private searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;

  ngOnInit(): void {
    // Setup debounced search
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(300), // Wait 300ms after user stops typing
      distinctUntilChanged(), // Only emit if value changes
      switchMap(query => {
        if (query.trim().length < 2) {
          this.searchResults = [];
          this.hasSearched = false;
          this.isSearching = false;
          return [];
        }

        this.isSearching = true;
        this.errorMessage = '';
        return this.mediaService.searchMedia(query);
      })
    ).subscribe({
      next: (response: any) => {
        this.searchResults = response.results || [];
        this.hasSearched = true;
        this.isSearching = false;
      },
      error: (error) => {
        console.error('Search error:', error);
        this.errorMessage = 'Search failed. Please try again.';
        this.searchResults = [];
        this.hasSearched = true;
        this.isSearching = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
  }

  onSearchInput(query: string): void {
    this.searchQuery = query;
    this.searchSubject.next(query);
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.searchResults = [];
    this.hasSearched = false;
    this.errorMessage = '';
  }

  goBack(): void {
    this.router.navigate(['/library']);
  }
}
