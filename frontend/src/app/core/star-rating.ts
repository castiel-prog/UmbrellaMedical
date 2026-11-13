import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-star-rating',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="stars" role="img" [attr.aria-label]="label()">
      @for (star of stars(); track $index) {
        <span class="star" [class.full]="star === 'full'" [class.half]="star === 'half'" aria-hidden="true">★</span>
      }
    </span>
    @if (count() !== null) {
      <span class="count">({{ count() }})</span>
    }
  `,
  styles: `
    .star { font-size: 1.15rem; color: var(--star-empty); }
    .star.full { color: var(--star); }
    .star.half {
      background: linear-gradient(90deg, var(--star) 50%, var(--star-empty) 50%);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
    .count { color: var(--muted); font-size: 0.85rem; margin-left: 0.25rem; }
  `
})
export class StarRating {
  readonly value = input(0);
  readonly count = input<number | null>(null);

  protected readonly stars = computed(() => {
    const rounded = Math.round(this.value() * 2) / 2;
    return Array.from({ length: 5 }, (_, index) =>
      rounded >= index + 1 ? 'full' : rounded >= index + 0.5 ? 'half' : 'empty');
  });

  protected readonly label = computed(() => `${this.value().toFixed(1)} out of 5 stars`);
}