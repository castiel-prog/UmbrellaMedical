import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Simple 24x24 line icons (stroke = currentColor), one consistent style for the whole site. */
const ICONS: Record<string, string[]> = {
  // specialties
  heart: ['M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z', 'M7.5 11.5h2.5l1.2-2 1.6 4 1.2-2h2.5'],
  tooth: ['M8 3.5c-2.4 0-3.8 1.9-3.8 4.2 0 1.9.9 3.3 1.3 5.6.4 2.4.9 7.2 2.6 7.2 1.5 0 1.4-4.2 3.9-4.2s2.4 4.2 3.9 4.2c1.7 0 2.2-4.8 2.6-7.2.4-2.3 1.3-3.7 1.3-5.6 0-2.3-1.4-4.2-3.8-4.2-1.6 0-2.5 1-4 1s-2.4-1-4-1z'],
  skin: ['M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z', 'M12 2v2', 'M12 20v2', 'M4.9 4.9l1.4 1.4', 'M17.7 17.7l1.4 1.4', 'M2 12h2', 'M20 12h2', 'M4.9 19.1l1.4-1.4', 'M17.7 6.3l1.4-1.4'],
  butterfly: ['M12 7v13', 'M12 9C10 5 4 4 4 8s4 5.5 8 4', 'M12 9c2-4 8-5 8-1s-4 5.5-8 4', 'M12 13c-2 .5-6 2-5.5 5 2 1 4.5-1 5.5-3', 'M12 13c2 .5 6 2 5.5 5-2 1-4.5-1-5.5-3'],
  stethoscope: ['M5 3v5a4 4 0 0 0 8 0V3', 'M9 12v2.5a5.5 5.5 0 0 0 11 0V12', 'M20 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'],
  female: ['M12 4a5 5 0 1 0 0 10 5 5 0 0 0 0-10z', 'M12 14v7', 'M9 18h6'],
  brain: ['M9.5 4A3 3 0 0 0 6.5 7a3 3 0 0 0-2 5.2A3 3 0 0 0 6.5 17a3 3 0 0 0 5.5 1.6V5.5A2 2 0 0 0 9.5 4z', 'M14.5 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5.2 3 3 0 0 1-2 4.8 3 3 0 0 1-5.5 1.6', 'M12 5.5A2 2 0 0 1 14.5 4'],
  eye: ['M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
  bone: ['M8.5 5.5a2.6 2.6 0 0 0-4.4 1.9A2.6 2.6 0 0 0 5.5 10l8.5 8.5a2.6 2.6 0 0 0 2.6 1.4 2.6 2.6 0 0 0 4.3-1.9 2.6 2.6 0 0 0-1.9-4.3A2.6 2.6 0 0 0 18.5 14L10 5.5a2.6 2.6 0 0 0-1.5 0z'],
  ear: ['M7 9a5.5 5.5 0 0 1 11 0c0 3.3-3.3 4.4-3.3 7.7a3.3 3.3 0 0 1-6.6 0', 'M10.3 9.5a2.2 2.2 0 0 1 4.4 0c0 1.6-2.2 2.2-2.2 3.3'],
  child: ['M12 5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15z', 'M9.5 14.5c1.4 1.3 3.6 1.3 5 0', 'M9.5 11h.01', 'M14.5 11h.01', 'M12 5c.8-1 2.2-1.2 2.8-.3'],
  talk: ['M4 5h16v11H10l-6 4V5z', 'M8.5 9.5h7', 'M8.5 12.5h4.5'],
  xray: ['M4 3h16v18H4z', 'M12 6v12', 'M8.5 8.5h7', 'M8 11.5h8', 'M8.5 14.5h7'],
  drop: ['M12 3c3 4 6.5 7.2 6.5 11a6.5 6.5 0 0 1-13 0C5.5 10.2 9 7 12 3z', 'M9 14.5a3 3 0 0 0 3 3'],
  // general
  cross: ['M9 3h6v6h6v6h-6v6H9v-6H3V9h6z'],
  shield: ['M12 3l8 3v6c0 4.4-3.4 8-8 9-4.6-1-8-4.6-8-9V6l8-3z', 'M8.5 12l2.5 2.5 4.5-5'],
  card: ['M3 6h18v12H3z', 'M3 10h18', 'M7 15h4'],
  umbrella: ['M3 12a9 9 0 0 1 18 0H3z', 'M12 12v6.5a2 2 0 0 1-4 0', 'M12 3v0'],
  bag: ['M6 8h12l-1 12H7L6 8z', 'M9 8V6a3 3 0 0 1 6 0v2'],
  search: ['M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z', 'M20 20l-4-4'],
  calendar: ['M4 6h16v14H4z', 'M4 10h16', 'M8 3v4', 'M16 3v4', 'M8 14h3'],
  clock: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 7v5l3 2'],
  phone: ['M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z'],
  arrow: ['M5 12h14', 'M13 6l6 6-6 6'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  pill: ['M8.5 4.5a4.2 4.2 0 0 1 6 0 4.2 4.2 0 0 1 0 6l-6 6a4.2 4.2 0 0 1-6-6z', 'M5.5 7.5l6 6', 'M15 15h6', 'M18 12v6'],
  // header and menus
  bell: ['M6 9a6 6 0 0 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9z', 'M10 19a2 2 0 0 0 4 0'],
  cart: ['M3 4h2.5l2.2 10.5h10.6L20.5 7H7', 'M9.5 19.5a1 1 0 1 0 0-.01', 'M17 19.5a1 1 0 1 0 0-.01'],
  sun: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M12 2.5v2', 'M12 19.5v2', 'M4.6 4.6l1.4 1.4', 'M18 18l1.4 1.4', 'M2.5 12h2', 'M19.5 12h2', 'M4.6 19.4L6 18', 'M18 6l1.4-1.4'],
  moon: ['M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z'],
  user: ['M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M4.5 20a7.5 7.5 0 0 1 15 0'],
  users: ['M9 5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z', 'M2.5 19.5a6.5 6.5 0 0 1 13 0', 'M16 5.5a3 3 0 0 1 0 6', 'M18 14a5.5 5.5 0 0 1 3.5 5.5'],
  logout: ['M10 4H5v16h5', 'M15 8l4 4-4 4', 'M19 12H9'],
  chevron: ['M6 9l6 6 6-6'],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  chart: ['M4 20V4', 'M4 20h16', 'M8 16v-5', 'M12 16V8', 'M16 16v-3'],
  settings: ['M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', 'M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z'],
  clipboard: ['M9 4h6v3H9z', 'M8 5.5H6v15h12v-15h-2', 'M9 12h6', 'M9 16h4'],
  file: ['M6 3h8l4 4v14H6z', 'M14 3v4h4', 'M9 13h6', 'M9 17h4'],
  receipt: ['M6 3h12v18l-3-2-3 2-3-2-3 2z', 'M9 8h6', 'M9 12h6', 'M9 16h3'],
  globe: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M3 12h18', 'M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z'],
  mail: ['M3 6h18v12H3z', 'M3 7l9 6 9-6'],
  pin: ['M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z', 'M12 7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z'],
  send: ['M4 12l16-8-6 16-2.5-6.5z', 'M11.5 13.5L20 4'],
  info: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 11v5', 'M12 7.5v.5']
};

const SPECIALTY_ICON: Record<string, string> = {
  Cardiologist: 'heart', Dentist: 'tooth', Dermatologist: 'skin', Endocrinologist: 'butterfly',
  'General Practitioner': 'stethoscope', Gynecologist: 'female', Neurologist: 'brain', Ophthalmologist: 'eye',
  Orthopedist: 'bone', 'Otolaryngologist (ENT)': 'ear', Pediatrician: 'child', Psychiatrist: 'talk',
  Radiologist: 'xray', Urologist: 'drop'
};

/** Icon name for a specialization, with a medical cross for anything new. */
export function specialtyIcon(specialization: string): string {
  return SPECIALTY_ICON[specialization] ?? 'cross';
}

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      [attr.stroke-width]="stroke()" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      @for (d of paths(); track $index) { <path [attr.d]="d" /> }
    </svg>
  `,
  styles: `:host { display: inline-flex; line-height: 0; }`
})
export class Icon {
  readonly name = input.required<string>();
  readonly size = input(24);
  readonly stroke = input(1.8);
  protected readonly paths = computed(() => ICONS[this.name()] ?? ICONS['cross']);
}
