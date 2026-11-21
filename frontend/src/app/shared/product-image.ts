import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { TranslatePipe } from '../core/i18n';
import { ProductCategory } from '../core/model';

type Shape =
  | 'box' | 'tin' | 'spray' | 'tub' | 'tube' | 'rollon' | 'bottle' | 'pump' | 'pads' | 'swabs'
  | 'pack' | 'mask' | 'plasters' | 'bandage' | 'gauze' | 'thermometer' | 'monitor' | 'oximeter';

// Pack colours per category: [main, dark accent]. Each product gets one of them by its name.
const PALETTES: Record<ProductCategory, [string, string][]> = {
  Medicines: [['#e03131', '#a61e1e'], ['#1971c2', '#124f8a'], ['#2f9e44', '#1f6e30'], ['#7048e8', '#4c2fa8'], ['#e8590c', '#a53e08']],
  Vitamins: [['#f59f00', '#b37400'], ['#f76707', '#b44a05'], ['#fab005', '#b37e00']],
  PersonalCare: [['#228be6', '#1864ab'], ['#15aabf', '#0c8599'], ['#ae3ec9', '#862e9c']],
  Hygiene: [['#12b886', '#0b7a59'], ['#4c6ef5', '#364fc7'], ['#20c997', '#0f8a66']],
  FirstAid: [['#f03e3e', '#b02525'], ['#e64980', '#a61e4d']],
  Devices: [['#495057', '#212529'], ['#5f3dc4', '#3b2483'], ['#1c7ed6', '#145a9c']]
};

/** Chooses a pack shape from the category and a few words in the product name. */
function shapeFor(name: string, category: ProductCategory): Shape {
  const n = name.toLowerCase();
  const has = (...words: string[]) => words.some(w => n.includes(w));
  switch (category) {
    case 'Medicines':
      if (has('spray')) return 'spray';
      if (has('lozenge')) return 'tin';
      return 'box';
    case 'Vitamins':
      return 'tub';
    case 'PersonalCare':
      if (has('deodorant')) return 'rollon';
      if (has('toothpaste', 'cream', 'sunscreen', 'gel')) return 'tube';
      return 'bottle';
    case 'Hygiene':
      if (has('pad')) return 'pads';
      if (has('swab', 'bud')) return 'swabs';
      if (has('sanitis', 'sanitiz', 'soap')) return 'pump';
      if (has('mask')) return 'mask';
      return 'pack';
    case 'FirstAid':
      if (has('plaster')) return 'plasters';
      if (has('bandage')) return 'bandage';
      if (has('gauze')) return 'gauze';
      if (has('antiseptic', 'solution')) return 'bottle';
      return 'box';
    case 'Devices':
      if (has('thermometer')) return 'thermometer';
      if (has('oximeter')) return 'oximeter';
      return 'monitor';
  }
}

function hash(text: string): number {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

/** "Paracetamol 500 mg" -> ["Paracetamol", "500 mg"]: the brand line and the strength line printed on the pack. */
function labelLines(name: string): [string, string] {
  const match = /^(.*?)\s+(\d[\d.,]*\s*(?:mg|mcg|iu|ml|g)\b.*)$/i.exec(name);
  const main = (match ? match[1] : name).trim();
  const sub = match ? match[2].trim() : '';
  return [main.length > 16 ? main.slice(0, 15) + '…' : main, sub.length > 14 ? sub.slice(0, 13) + '…' : sub];
}

/**
 * The picture of a store product: the uploaded photo when there is one, otherwise a drawn packshot
 * (box, tub, tube, bottle, device...) in a colour of its own with the product name on the pack.
 */
@Component({
  selector: 'app-product-image',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (imageUrl() && !failed()) {
      <img [src]="imageUrl()" [alt]="name()" loading="lazy" (error)="failed.set(true)" />
    } @else {
      <svg viewBox="0 0 160 120" role="img" [attr.aria-label]="name()">
        <ellipse cx="80" cy="110" rx="52" ry="5" fill="#000" opacity="0.08" />
        @switch (shape()) {
          @case ('box') {
            <!-- carton with a blister strip sticking out -->
            <rect x="96" y="30" width="34" height="62" rx="4" fill="#dee2e6" stroke="#adb5bd" />
            @for (y of [38, 52, 66, 80]; track y) { <ellipse cx="113" [attr.cy]="y" rx="8" ry="5" fill="#fff" stroke="#ced4da" /> }
            <rect x="28" y="22" width="78" height="86" rx="5" [attr.fill]="color()[0]" />
            <rect x="28" y="22" width="78" height="14" rx="5" [attr.fill]="color()[1]" />
            <rect x="34" y="46" width="66" height="34" rx="3" fill="#fff" />
            <text x="67" y="61" text-anchor="middle" class="t1" [attr.textLength]="fit(label()[0], 62, 6.4)" lengthAdjust="spacingAndGlyphs" [attr.fill]="color()[1]">{{ label()[0] }}</text>
            <text x="67" y="74" text-anchor="middle" class="t2" [attr.textLength]="fit(label()[1], 62, 5)" lengthAdjust="spacingAndGlyphs">{{ label()[1] }}</text>
            @if (rx()) { <text x="96" y="100" text-anchor="end" class="rx" fill="#fff">℞</text> }
          }
          @case ('tin') {
            <ellipse cx="80" cy="84" rx="48" ry="16" [attr.fill]="color()[1]" />
            <rect x="32" y="56" width="96" height="28" [attr.fill]="color()[1]" />
            <ellipse cx="80" cy="56" rx="48" ry="16" [attr.fill]="color()[0]" />
            <text x="80" y="60" text-anchor="middle" class="t1" [attr.textLength]="fit(label()[0], 80, 6.4)" lengthAdjust="spacingAndGlyphs" fill="#fff">{{ label()[0] }}</text>
          }
          @case ('spray') {
            <rect x="72" y="14" width="16" height="16" rx="3" fill="#adb5bd" />
            <rect x="66" y="28" width="28" height="10" rx="3" fill="#868e96" />
            <rect x="52" y="36" width="56" height="72" rx="14" [attr.fill]="color()[0]" />
            <rect x="58" y="56" width="44" height="32" rx="4" fill="#fff" />
            <text x="80" y="70" text-anchor="middle" class="t2b" [attr.textLength]="fit(label()[0], 40, 5.6)" lengthAdjust="spacingAndGlyphs" [attr.fill]="color()[1]">{{ label()[0] }}</text>
            <text x="80" y="82" text-anchor="middle" class="t3">{{ 'nasal spray' | t }}</text>
          }
          @case ('tub') {
            <rect x="44" y="20" width="72" height="18" rx="5" [attr.fill]="color()[1]" />
            <rect x="40" y="36" width="80" height="72" rx="12" [attr.fill]="color()[0]" />
            <rect x="46" y="52" width="68" height="38" rx="4" fill="#fff" />
            <text x="80" y="68" text-anchor="middle" class="t1" [attr.textLength]="fit(label()[0], 62, 6.4)" lengthAdjust="spacingAndGlyphs" [attr.fill]="color()[1]">{{ label()[0] }}</text>
            <text x="80" y="82" text-anchor="middle" class="t2" [attr.textLength]="fit(label()[1], 62, 5)" lengthAdjust="spacingAndGlyphs">{{ label()[1] }}</text>
          }
          @case ('tube') {
            <rect x="70" y="10" width="20" height="14" rx="3" fill="#495057" />
            <path d="M58 24 H102 L112 106 H48 Z" [attr.fill]="color()[0]" />
            <rect x="46" y="100" width="68" height="8" rx="2" [attr.fill]="color()[1]" />
            <rect x="57" y="50" width="46" height="30" rx="3" fill="#fff" />
            <text x="80" y="64" text-anchor="middle" class="t2b" [attr.textLength]="fit(label()[0], 42, 5.6)" lengthAdjust="spacingAndGlyphs" [attr.fill]="color()[1]">{{ label()[0] }}</text>
            <text x="80" y="76" text-anchor="middle" class="t3" [attr.textLength]="fit(label()[1] || 'care', 42, 4.3)" lengthAdjust="spacingAndGlyphs">{{ label()[1] || 'care' }}</text>
          }
          @case ('rollon') {
            <rect x="60" y="14" width="40" height="30" rx="14" fill="#e9ecef" stroke="#ced4da" />
            <rect x="56" y="40" width="48" height="68" rx="10" [attr.fill]="color()[0]" />
            <rect x="62" y="58" width="36" height="30" rx="3" fill="#fff" />
            <text x="80" y="72" text-anchor="middle" class="t3b" [attr.fill]="color()[1]">{{ 'deodorant' | t }}</text>
            <text x="80" y="83" text-anchor="middle" class="t3">48h</text>
          }
          @case ('bottle') {
            <rect x="70" y="12" width="20" height="14" rx="3" [attr.fill]="color()[1]" />
            <path d="M66 26 H94 V36 Q116 44 116 62 V100 Q116 108 108 108 H52 Q44 108 44 100 V62 Q44 44 66 36 Z" [attr.fill]="color()[0]" />
            <rect x="52" y="58" width="56" height="34" rx="3" fill="#fff" />
            <text x="80" y="73" text-anchor="middle" class="t2b" [attr.textLength]="fit(label()[0], 52, 5.6)" lengthAdjust="spacingAndGlyphs" [attr.fill]="color()[1]">{{ label()[0] }}</text>
            <text x="80" y="85" text-anchor="middle" class="t3" [attr.textLength]="fit(label()[1], 52, 4.3)" lengthAdjust="spacingAndGlyphs">{{ label()[1] }}</text>
          }
          @case ('pump') {
            <rect x="74" y="10" width="34" height="8" rx="3" fill="#495057" />
            <rect x="74" y="16" width="10" height="20" fill="#495057" />
            <rect x="66" y="32" width="28" height="10" rx="3" fill="#868e96" />
            <rect x="48" y="40" width="64" height="68" rx="10" [attr.fill]="color()[0]" opacity="0.9" />
            <rect x="54" y="58" width="52" height="30" rx="3" fill="#fff" />
            <text x="80" y="72" text-anchor="middle" class="t2b" [attr.fill]="color()[1]">{{ 'hand gel' | t }}</text>
            <text x="80" y="83" text-anchor="middle" class="t3">{{ '70% alcohol' | t }}</text>
          }
          @case ('pads') {
            <rect x="34" y="34" width="92" height="74" rx="8" [attr.fill]="color()[0]" opacity="0.25" />
            @for (i of [0, 1, 2, 3, 4]; track i) { <ellipse cx="80" [attr.cy]="96 - i * 12" rx="38" ry="12" fill="#fff" stroke="#dee2e6" /> }
            <rect x="34" y="34" width="92" height="14" rx="6" [attr.fill]="color()[0]" />
            <text x="80" y="45" text-anchor="middle" class="t3b" fill="#fff">{{ 'cotton pads' | t }}</text>
          }
          @case ('swabs') {
            <rect x="30" y="40" width="100" height="66" rx="10" [attr.fill]="color()[0]" opacity="0.25" />
            @for (i of [0, 1, 2, 3, 4, 5]; track i) {
              <g [attr.transform]="'rotate(' + (-25 + i * 10) + ' 80 100)'">
                <rect x="78.5" y="30" width="3" height="70" fill="#f1f3f5" />
                <ellipse cx="80" cy="30" rx="5" ry="8" fill="#fff" stroke="#dee2e6" />
              </g>
            }
            <rect x="30" y="86" width="100" height="20" rx="6" [attr.fill]="color()[0]" />
            <text x="80" y="100" text-anchor="middle" class="t3b" fill="#fff">{{ 'cotton swabs' | t }}</text>
          }
          @case ('mask') {
            <path d="M40 50 Q80 34 120 50 L114 92 Q80 108 46 92 Z" fill="#a5d8ff" stroke="#74c0fc" />
            @for (y of [62, 72, 82]; track y) { <path [attr.d]="'M46 ' + y + ' Q80 ' + (y - 8) + ' 114 ' + y" fill="none" stroke="#74c0fc" /> }
            <path d="M40 52 Q22 70 46 90" fill="none" stroke="#adb5bd" stroke-width="2" />
            <path d="M120 52 Q138 70 114 90" fill="none" stroke="#adb5bd" stroke-width="2" />
          }
          @case ('pack') {
            <rect x="30" y="34" width="100" height="72" rx="14" [attr.fill]="color()[0]" />
            <ellipse cx="80" cy="50" rx="28" ry="9" [attr.fill]="color()[1]" />
            <rect x="40" y="64" width="80" height="28" rx="4" fill="#fff" />
            <text x="80" y="78" text-anchor="middle" class="t2b" [attr.textLength]="fit(label()[0], 76, 5.6)" lengthAdjust="spacingAndGlyphs" [attr.fill]="color()[1]">{{ label()[0] }}</text>
            <text x="80" y="89" text-anchor="middle" class="t3" [attr.textLength]="fit(label()[1] || 'sensitive', 76, 4.3)" lengthAdjust="spacingAndGlyphs">{{ label()[1] || 'sensitive' }}</text>
          }
          @case ('plasters') {
            @for (r of [-18, 6, 26]; track r) {
              <g [attr.transform]="'rotate(' + r + ' 80 66)'">
                <rect x="36" y="56" width="88" height="22" rx="11" fill="#f3c69b" stroke="#e0a87a" />
                <rect x="66" y="58" width="28" height="18" rx="3" fill="#fbe3cc" />
              </g>
            }
          }
          @case ('bandage') {
            <rect x="36" y="44" width="64" height="58" rx="6" fill="#f1e2c8" stroke="#d9c39c" />
            <ellipse cx="68" cy="44" rx="32" ry="10" fill="#fbf1de" stroke="#d9c39c" />
            <ellipse cx="68" cy="44" rx="9" ry="3" fill="#d9c39c" />
            <path d="M100 60 H132 V84 H100" fill="#f1e2c8" stroke="#d9c39c" />
          }
          @case ('gauze') {
            <rect x="38" y="30" width="70" height="70" rx="4" fill="#fff" stroke="#dee2e6" transform="rotate(-8 73 65)" />
            <rect x="52" y="36" width="70" height="70" rx="4" fill="#f8f9fa" stroke="#ced4da" />
            @for (i of [0, 1, 2, 3, 4, 5]; track i) {
              <line [attr.x1]="56 + i * 11" y1="40" [attr.x2]="56 + i * 11" y2="102" stroke="#e9ecef" />
              <line x1="56" [attr.y1]="40 + i * 11" x2="118" [attr.y2]="40 + i * 11" stroke="#e9ecef" />
            }
          }
          @case ('thermometer') {
            <rect x="30" y="52" width="96" height="22" rx="11" fill="#f8f9fa" stroke="#adb5bd" />
            <rect x="50" y="56" width="34" height="14" rx="2" fill="#c3fae8" stroke="#63e6be" />
            <text x="67" y="67" text-anchor="middle" class="t3b" fill="#087f5b">36.6°</text>
            <rect x="122" y="58" width="16" height="10" rx="5" fill="#adb5bd" />
            <circle cx="100" cy="63" r="5" [attr.fill]="color()[0]" />
          }
          @case ('oximeter') {
            <rect x="40" y="38" width="80" height="60" rx="22" [attr.fill]="color()[0]" />
            <rect x="54" y="50" width="52" height="30" rx="6" fill="#212529" />
            <text x="62" y="70" class="t2b" fill="#69db7c">98%</text>
            <text x="102" y="70" text-anchor="end" class="t3b" fill="#ffd43b">72</text>
          }
          @case ('monitor') {
            <rect x="34" y="36" width="68" height="64" rx="10" [attr.fill]="color()[0]" />
            <rect x="42" y="44" width="52" height="30" rx="4" fill="#e7f5ff" />
            <text x="68" y="58" text-anchor="middle" class="t2b" fill="#1864ab">120</text>
            <text x="68" y="70" text-anchor="middle" class="t3b" fill="#1864ab">80</text>
            <circle cx="68" cy="88" r="6" fill="#fff" />
            <path d="M102 70 Q124 70 124 50 Q124 30 136 30" fill="none" stroke="#868e96" stroke-width="3" />
            <rect x="118" y="18" width="30" height="20" rx="6" fill="#495057" />
          }
        }
      </svg>
    }
  `,
  styles: `
    :host { display: flex; align-items: center; justify-content: center; overflow: hidden; }
    img { width: 100%; height: 100%; object-fit: contain; }
    svg { width: 100%; height: 100%; }
    .t1 { font: 700 11px system-ui, sans-serif; }
    .t2 { font: 600 9px system-ui, sans-serif; fill: #495057; }
    .t2b { font: 700 9.5px system-ui, sans-serif; }
    .t3 { font: 500 7.5px system-ui, sans-serif; fill: #868e96; }
    .t3b { font: 700 8px system-ui, sans-serif; }
    .rx { font: 700 14px Georgia, serif; }
  `
})
export class ProductImage {
  readonly name = input.required<string>();
  readonly category = input.required<ProductCategory>();
  readonly imageUrl = input<string | null>(null);
  readonly rx = input(false);

  /** The photo failed to load: fall back to the drawing. */
  protected readonly failed = signal(false);
  protected readonly shape = computed(() => shapeFor(this.name(), this.category()));
  protected readonly color = computed(() => {
    const palette = PALETTES[this.category()];
    return palette[hash(this.name()) % palette.length];
  });
  protected readonly label = computed(() => labelLines(this.name()));

  /** Squeezes a label line into its space when it would be too wide; otherwise leaves it at its natural width. */
  protected fit(text: string, maxWidth: number, charWidth: number): number | null {
    return text.length * charWidth > maxWidth ? maxWidth : null;
  }
}
