import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { map, catchError, of } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Check if token exists
  const token = authService.getToken();

  if (!token) {
    // No token, redirect to login immediately
    return router.parseUrl('/login');
  }

  // Token exists, verify it with the backend
  return authService.verifyToken().pipe(
    map(() => true),
    catchError(() => {
      // Verification failed, redirect to login
      return of(router.parseUrl('/login'));
    })
  );
};
