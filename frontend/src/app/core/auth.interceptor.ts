import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const token = auth.token;

  const isApi = request.url.startsWith('/api/');
  const isAuthCall = request.url.startsWith('/api/auth/login') || request.url.startsWith('/api/auth/register');

  const outgoing = token && isApi && !isAuthCall
    ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : request;

  return next(outgoing).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && token && !isAuthCall) {
        auth.logout();
      }
      return throwError(() => error);
    })
  );
};