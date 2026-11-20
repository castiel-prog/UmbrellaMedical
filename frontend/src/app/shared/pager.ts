import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '../core/i18n';

/** Previous / numbered pages / Next. Long ranges collapse to: 1 … 4 5 6 … 12. */
@Component({
  selector: 'app-pager',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (totalPages() > 1) {
      <nav class="pager" [attr.aria-label]="'Pages' | t">
        <button class="btn small pager-step" type="button" (click)="go(page() - 1)" [disabled]="page() <= 1 || disabled()">‹ {{ 'Previous' | t }}</button>
        <span class="pager-numbers">
          @for (n of numbers(); track $index) {
            @if (n === null) {
              <span class="pager-gap" aria-hidden="true">…</span>
            } @else {
              <button type="button" class="pager-num" [class.current]="n === page()" [attr.aria-current]="n === page() ? 'page' : null"
                [attr.aria-label]="'Page {page} of {total}' | t: { page: n, total: totalPages() }" [disabled]="disabled()" (click)="go(n)">{{ n }}</button>
            }
          }
        </span>
        <span class="pager-compact">{{ 'Page {page} of {total}' | t: { page: page(), total: totalPages() } }}</span>
        <button class="btn small pager-step" type="button" (click)="go(page() + 1)" [disabled]="page() >= totalPages() || disabled()">{{ 'Next' | t }} ›</button>
      </nav>
    }
  `
})
export class Pager {
  readonly page = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly totalCount = input.required<number>();
  readonly disabled = input(false);
  readonly pageChange = output<number>();

  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalCount() / this.pageSize())));

  /** Page numbers to show; null marks a gap. Always the first, last and the pages around the current one. */
  protected readonly numbers = computed<(number | null)[]>(() => {
    const total = this.totalPages(), current = this.page();
    const wanted = new Set([1, total, current - 1, current, current + 1].filter(n => n >= 1 && n <= total));
    if (current <= 3) [2, 3, 4].forEach(n => n <= total && wanted.add(n));
    if (current >= total - 2) [total - 3, total - 2, total - 1].forEach(n => n >= 1 && wanted.add(n));
    const sorted = [...wanted].sort((a, b) => a - b);
    const out: (number | null)[] = [];
    sorted.forEach((n, i) => {
      if (i > 0 && n - sorted[i - 1] > 1) out.push(n - sorted[i - 1] === 2 ? n - 1 : null);
      out.push(n);
    });
    return out;
  });

  protected go(n: number): void {
    if (n >= 1 && n <= this.totalPages() && n !== this.page()) this.pageChange.emit(n);
  }
}
