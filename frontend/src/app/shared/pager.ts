import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'app-pager',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (totalPages() > 1) {
      <nav class="pager" aria-label="Pages">
        <button class="btn small" type="button" (click)="pageChange.emit(page() - 1)" [disabled]="page() <= 1 || disabled()">Previous</button>
        <span>Page {{ page() }} of {{ totalPages() }}</span>
        <button class="btn small" type="button" (click)="pageChange.emit(page() + 1)" [disabled]="page() >= totalPages() || disabled()">Next</button>
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
}
