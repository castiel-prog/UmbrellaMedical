import { ChangeDetectionStrategy, Component, input } from '@angular/core';

interface Wedge {
  path: string;
  fill: string;
}

function buildWedges(): Wedge[] {
  const center = 50;
  const radius = 40;

  return Array.from({ length: 8 }, (_, index) => {
    const start = ((index * 45 - 90) * Math.PI) / 180;
    const end = (((index + 1) * 45 - 90) * Math.PI) / 180;

    const x1 = (center + radius * Math.cos(start)).toFixed(2);
    const y1 = (center + radius * Math.sin(start)).toFixed(2);
    const x2 = (center + radius * Math.cos(end)).toFixed(2);
    const y2 = (center + radius * Math.sin(end)).toFixed(2);

    return {
      path: `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2} Z`,
      fill: index % 2 === 0 ? '#d3122a' : '#ffffff'
    };
  });
}

@Component({
  selector: 'app-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 100 100" role="img" aria-label="Umbrella Medical Center logo">
      <circle cx="50" cy="50" r="48" fill="#0b0b0c" />
      @for (wedge of wedges; track $index) {
        <path [attr.d]="wedge.path" [attr.fill]="wedge.fill" stroke="#0b0b0c" stroke-width="2" stroke-linejoin="round" />
      }
      <circle cx="50" cy="50" r="6" fill="#0b0b0c" />
      <circle cx="50" cy="50" r="48" fill="none" stroke="#ffffff" stroke-width="2" />
    </svg>
  `,
  styles: `:host { display: inline-flex; line-height: 0; }`
})
export class Logo {
  readonly size = input(40);
  protected readonly wedges = buildWedges();
}