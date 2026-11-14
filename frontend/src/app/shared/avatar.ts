import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

/**
 * Profile picture with an initials fallback. Pictures are loaded through HttpClient so the login
 * token is sent along (patient pictures are private), then shown from a local object URL.
 */
@Component({
  selector: 'app-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (src(); as s) {
      <img [class]="'avatar ' + size()" [src]="s" [alt]="alt() ? name() : ''" />
    } @else {
      <div [class]="'avatar ' + size()" aria-hidden="true">{{ initials() }}</div>
    }
  `,
  styles: `:host { display: inline-flex; flex: 0 0 auto; }`
})
export class Avatar {
  private readonly http = inject(HttpClient);

  readonly url = input<string | null>(null);
  readonly name = input('');
  readonly size = input<'' | 'small' | 'big'>('');
  readonly alt = input(false);

  protected readonly src = signal<string | null>(null);
  private objectUrl: string | null = null;

  protected readonly initials = computed(() =>
    this.name()
      .replace(/^Dr\.\s*/i, '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0].toUpperCase())
      .join(''));

  constructor() {
    effect(onCleanup => {
      const url = this.url();
      this.release();
      if (!url) return;

      const sub = this.http.get(url, { responseType: 'blob' }).subscribe({
        next: blob => {
          this.release();
          this.objectUrl = URL.createObjectURL(blob);
          this.src.set(this.objectUrl);
        },
        error: () => this.release()
      });
      onCleanup(() => sub.unsubscribe());
    });

    inject(DestroyRef).onDestroy(() => this.release());
  }

  private release(): void {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
    this.src.set(null);
  }
}
