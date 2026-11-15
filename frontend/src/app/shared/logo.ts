import { ChangeDetectionStrategy, Component, input } from '@angular/core';

let nextId = 0;

/**
 * Umbrella Medical Center logo: an open umbrella (3 red and 3 white canopy panels) whose shaft is a red
 * medical cross, over a white heartbeat (ECG) line, on a dark round badge. Original artwork.
 */
@Component({
  selector: 'app-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 100 100" role="img" aria-label="Umbrella Medical Center logo">
      <defs>
        <clipPath [attr.id]="clipId"><circle cx="50" cy="50" r="45.5" /></clipPath>
      </defs>
      <circle cx="50" cy="50" r="48" fill="#0b0b0c" />

      <!-- heartbeat line in the background -->
      <path [attr.clip-path]="'url(#' + clipId + ')'" d="M2 70 H13 L16 66 L19 70 H21 L24.5 57 L28.5 82 L31.5 70 H68.5 L71.5 57 L75.5 82 L79 70 H81 L84 66 L87 70 H98"
        fill="none" stroke="#ffffff" stroke-opacity="0.9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />

      <circle cx="50" cy="50" r="46.5" fill="none" stroke="#ffffff" stroke-width="2" />

      <!-- tip -->
      <path d="M50 14 V7.5" stroke="#ffffff" stroke-width="3" stroke-linecap="round" />

      <!-- canopy: six panels, alternating red and white, with scalloped edges -->
      <g stroke="#0b0b0c" stroke-width="1.4" stroke-linejoin="round">
        <path d="M50 13 Q13 15 10 50 Q16.67 43 23.33 50 Q27 19 50 13 Z" fill="#d3122a" />
        <path d="M50 13 Q27 19 23.33 50 Q30 43 36.67 50 Q39 24 50 13 Z" fill="#ffffff" />
        <path d="M50 13 Q39 24 36.67 50 Q43.33 43 50 50 Z" fill="#d3122a" />
        <path d="M50 13 L50 50 Q56.67 43 63.33 50 Q61 24 50 13 Z" fill="#ffffff" />
        <path d="M50 13 Q61 24 63.33 50 Q70 43 76.67 50 Q73 19 50 13 Z" fill="#d3122a" />
        <path d="M50 13 Q73 19 76.67 50 Q83.33 43 90 50 Q87 15 50 13 Z" fill="#ffffff" />
      </g>

      <!-- medical cross held by the umbrella -->
      <path d="M44 52 H56 V63 H67 V75 H56 V88 H44 V75 H33 V63 H44 Z"
        fill="#d3122a" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round" />
    </svg>
  `,
  styles: `:host { display: inline-flex; line-height: 0; }`
})
export class Logo {
  readonly size = input(40);
  /** Unique per logo on the page, so several logos don't share one clip path. */
  protected readonly clipId = `logo-clip-${nextId++}`;
}
