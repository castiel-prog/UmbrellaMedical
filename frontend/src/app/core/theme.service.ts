import { Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private static readonly KEY = 'umbrella.theme';

  private readonly current = signal<Theme>(this.initial());
  readonly theme = this.current.asReadonly();

  constructor() {
    this.apply(this.current());
  }

  toggle(): void {
    this.set(this.current() === 'dark' ? 'light' : 'dark');
  }

  set(theme: Theme): void {
    if (theme === this.current()) return;
    this.current.set(theme);
    try { localStorage.setItem(ThemeService.KEY, theme); } catch { /* storage unavailable */ }
    this.apply(theme);
  }

  private initial(): Theme {
    const stored = localStorage.getItem(ThemeService.KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  private apply(theme: Theme): void {
    document.documentElement.dataset['theme'] = theme;
  }
}