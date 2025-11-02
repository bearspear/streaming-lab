import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/library',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('./components/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'register',
    loadComponent: () => import('./components/register/register.component').then(m => m.RegisterComponent)
  },
  {
    path: 'library',
    loadComponent: () => import('./components/library/library.component').then(m => m.LibraryComponent),
    canActivate: [authGuard]
  },
  {
    path: 'search',
    loadComponent: () => import('./components/search/search.component').then(m => m.SearchComponent),
    canActivate: [authGuard]
  },
  {
    path: 'watch/:id',
    loadComponent: () => import('./components/video-player/video-player.component').then(m => m.VideoPlayerComponent),
    canActivate: [authGuard]
  },
  {
    path: 'media/:id',
    loadComponent: () => import('./components/media-details/media-details.component').then(m => m.MediaDetailsComponent),
    canActivate: [authGuard]
  },
  {
    path: 'tv/:id',
    loadComponent: () => import('./components/tv-show-details/tv-show-details.component').then(m => m.TvShowDetailsComponent),
    canActivate: [authGuard]
  },
  {
    path: 'admin',
    loadComponent: () => import('./components/admin/admin.component').then(m => m.AdminComponent),
    canActivate: [authGuard, adminGuard]
  },
  {
    path: '**',
    redirectTo: '/login'
  }
];
