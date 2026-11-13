import { HttpErrorResponse } from '@angular/common/http';

export function apiErrorMessage(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) return 'Something went wrong. Please try again.';
  if (error.status === 0) return 'The server cannot be reached. Please try again later.';

  const body = error.error;
  if (body && typeof body === 'object') {
    const errors = (body as { errors?: Record<string, string[]> }).errors;
    if (errors && typeof errors === 'object') {
      const messages = Object.values(errors).flat();
      if (messages.length > 0) return messages.join(' ');
    }

    const named = body as { message?: unknown; detail?: unknown; title?: unknown };
    for (const value of [named.message, named.detail, named.title]) {
      if (typeof value === 'string' && value.length > 0) return value;
    }
  }

  switch (error.status) {
    case 401: return 'Please log in again.';
    case 403: return 'You do not have permission to do this.';
    case 404: return 'Not found.';
    case 429: return 'Too many requests. Please wait a moment and try again.';
    default: return 'Something went wrong. Please try again.';
  }
}