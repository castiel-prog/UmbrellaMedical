import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { DoctorDetails, Education } from '../core/model';
import { Logo } from './logo';

/**
 * An Umbrella Medical Center certificate for a doctor, drawn as a framed paper document.
 * 'excellence' praises the doctor's work; 'degree' confirms one of their medical degrees.
 */
@Component({
  selector: 'app-certificate',
  imports: [Logo, DatePipe, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="paper" [attr.aria-label]="title()">
      <div class="frame">
        <app-logo class="watermark" [size]="260" aria-hidden="true" />

        <header>
          <app-logo [size]="54" />
          <p class="clinic">UMBRELLA MEDICAL CENTER</p>
          <h3 class="title">{{ title() }}</h3>
        </header>

        @if (kind() === 'excellence') {
          <p class="lead-in">This certificate is proudly presented to</p>
          <p class="name">{{ fullName() }}</p>
          <p class="body">
            in recognition of outstanding skill, sound clinical judgement and genuine compassion in
            <strong>{{ doctor().specialization }}</strong>.
            Across {{ doctor().yearsOfExperience }} years of practice, {{ shortName() }} has consistently
            delivered care that meets the highest standards of Umbrella Medical Center, earning the
            trust and gratitude of patients and colleagues alike.
          </p>
          @if (doctor().reviewCount > 0) {
            <p class="rating">★ Rated {{ doctor().averageRating | number: '1.1-1' }} / 5 by {{ doctor().reviewCount }} patient{{ doctor().reviewCount === 1 ? '' : 's' }}</p>
          }
        } @else {
          <p class="lead-in">Umbrella Medical Center confirms that</p>
          <p class="name">{{ fullName() }}</p>
          <p class="body">
            holds the degree of <strong>{{ education()?.degree }}</strong>, awarded by
            <strong>{{ education()?.institution }}</strong> in {{ education()?.graduationYear }}
            after studies begun in {{ education()?.startYear }}, and is licensed to practise medicine
            under licence no. <strong>{{ doctor().licenseNumber }}</strong>.
          </p>
          <p class="rating">Credentials reviewed and verified by the Umbrella Credentialing Office.</p>
        }

        <footer>
          <div class="sign">
            <span class="signature">{{ kind() === 'excellence' ? 'T. Morgan' : 'S. Hale' }}</span>
            <span class="line"></span>
            <small>{{ kind() === 'excellence' ? 'Chief Medical Officer' : 'Head of Credentialing' }}</small>
          </div>

          <div class="seal" aria-hidden="true">
            <svg viewBox="0 0 120 120">
              <defs>
                <path [attr.id]="ringId()" d="M 60,60 m -44,0 a 44,44 0 1,1 88,0 a 44,44 0 1,1 -88,0" />
              </defs>
              <circle cx="60" cy="60" r="58" fill="#9e0c24" />
              <circle cx="60" cy="60" r="54" fill="none" stroke="#f3d9a4" stroke-width="1.5" />
              <circle cx="60" cy="60" r="33" fill="none" stroke="#f3d9a4" stroke-width="1.5" />
              <text fill="#f3d9a4" font-size="9" font-weight="700" letter-spacing="1.6">
                <textPath [attr.href]="'#' + ringId()">UMBRELLA MEDICAL CENTER ★ CERTIFIED ★</textPath>
              </text>
            </svg>
            <app-logo class="seal-logo" [size]="56" />
          </div>

          <div class="sign">
            <span class="signature">{{ kind() === 'excellence' ? 'R. Lindqvist' : 'T. Morgan' }}</span>
            <span class="line"></span>
            <small>{{ kind() === 'excellence' ? 'Board of Clinical Standards' : 'Chief Medical Officer' }}</small>
          </div>
        </footer>

        <p class="meta">
          {{ kind() === 'excellence' ? 'Awarded' : 'Verified' }} {{ doctor().memberSince | date: 'd MMMM y' }}
          · Certificate no. {{ number() }}
        </p>
      </div>
    </article>
  `,
  styles: `
    :host { display: block; height: 100%; container-type: inline-size; }
    .paper { height: 100%; }
    .frame { height: 100%; display: flex; flex-direction: column; }
    footer { margin-top: auto !important; padding-top: 0.75rem; }

    /* A paper document keeps its paper colours in both themes. */
    .paper {
      background: #fbf6e9;
      color: #2b2118;
      padding: 0.6rem;
      border-radius: 6px;
      box-shadow: 0 6px 22px rgba(0, 0, 0, 0.18);
    }
    .frame {
      position: relative;
      overflow: hidden;
      padding: 1.6rem 1.8rem 1rem;
      border: 3px double #9e0c24;
      outline: 1px solid #c9a75a;
      outline-offset: -9px;
      text-align: center;
      font-family: Georgia, 'Times New Roman', 'Noto Serif Georgian', serif;
    }
    .watermark {
      position: absolute; inset: 50% auto auto 50%; transform: translate(-50%, -50%);
      opacity: 0.06; pointer-events: none;
    }
    header { position: relative; display: flex; flex-direction: column; align-items: center; gap: 0.35rem; }
    .clinic { margin: 0; font-family: system-ui, sans-serif; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.32em; color: #9e0c24; }
    .title { margin: 0.1rem 0 0.6rem; font-size: 1.55rem; font-weight: 400; font-style: italic; letter-spacing: 0.02em; }
    .title::after { content: ''; display: block; width: 4rem; height: 2px; margin: 0.45rem auto 0; background: #c9a75a; }
    .lead-in { position: relative; margin: 0; font-size: 0.95rem; color: #5d4c3a; }
    .name {
      position: relative; margin: 0.25rem 0 0.5rem; font-size: 1.9rem; line-height: 1.2;
      font-family: 'Segoe Script', 'Brush Script MT', 'Lucida Handwriting', Georgia, cursive; color: #1d1610;
    }
    .body { position: relative; max-width: 34rem; margin: 0 auto 0.5rem; font-size: 0.95rem; line-height: 1.55; }
    .rating { position: relative; margin: 0 0 0.6rem; font-size: 0.85rem; color: #7a5b16; font-style: italic; }

    footer { position: relative; display: grid; grid-template-columns: 1fr auto 1fr; align-items: end; gap: 1rem; margin-top: 0.75rem; }
    .sign { display: flex; flex-direction: column; align-items: center; }
    .signature { font-family: 'Segoe Script', 'Brush Script MT', 'Lucida Handwriting', cursive; font-size: 1.15rem; color: #1f2a5c; transform: rotate(-3deg); }
    .line { display: block; width: 100%; max-width: 11rem; height: 1px; margin: 0.15rem 0 0.25rem; background: #2b2118; }
    .sign small { font-family: system-ui, sans-serif; font-size: 0.7rem; letter-spacing: 0.04em; color: #5d4c3a; }

    .seal { position: relative; width: 104px; height: 104px; filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.25)); }
    .seal svg { width: 100%; height: 100%; }
    .seal-logo { position: absolute; inset: 50% auto auto 50%; transform: translate(-50%, -50%); }

    .meta { position: relative; margin: 0.8rem 0 0; font-family: system-ui, sans-serif; font-size: 0.7rem; color: #7d6b55; letter-spacing: 0.03em; }

    @container (max-width: 460px) {
      .frame { padding: 1.2rem 0.9rem 0.8rem; }
      .title { font-size: 1.25rem; }
      .name { font-size: 1.5rem; }
      .body { font-size: 0.88rem; }
      footer { grid-template-columns: 1fr 1fr; }
      .seal { grid-column: 1 / -1; grid-row: 1; justify-self: center; }
    }
  `
})
export class Certificate {
  readonly kind = input<'excellence' | 'degree'>('excellence');
  readonly doctor = input.required<DoctorDetails>();
  readonly education = input<Education | null>(null);

  protected readonly fullName = computed(() => `Dr. ${this.doctor().firstName} ${this.doctor().lastName}`);
  protected readonly shortName = computed(() => `Dr. ${this.doctor().lastName}`);
  protected readonly title = computed(() =>
    this.kind() === 'excellence' ? 'Certificate of Clinical Excellence' : 'Verified Medical Degree');

  // Unique id per certificate so several seals on one page don't share a text path.
  protected readonly ringId = computed(() =>
    `seal-ring-${this.doctor().id}-${this.kind()}-${this.education()?.graduationYear ?? 0}`);

  protected readonly number = computed(() => {
    const suffix = this.kind() === 'excellence' ? 'EX' : `DG${this.education()?.graduationYear ?? ''}`;
    return `UMC-${this.doctor().licenseNumber}-${suffix}`;
  });
}
