import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/auth.service';
import { DoctorsApi } from '../../core/doctors.api';
import { CATEGORY_INFO, StoreApi } from '../../core/store.api';
import { ClinicService, DoctorListItem, Product, ProductCategory, Specialization } from '../../core/model';
import { DoctorCard } from '../../core/doctor-card';
import { Logo } from '../../shared/logo';
import { Icon, specialtyIcon } from '../../shared/icon';
import { ProductImage } from '../../shared/product-image';
import { I18n, TranslatePipe } from '../../core/i18n';

@Component({
  selector: 'app-home',
  imports: [FormsModule, RouterLink, CurrencyPipe, DoctorCard, Logo, Icon, ProductImage, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Hero -->
    <section class="hero home-hero">
      <div class="hero-text">
        <p class="hero-kicker">{{ 'UMBRELLA MEDICAL CENTER · TBILISI' | t }}</p>
        <h1>{{ 'Care you can book' | t }}<br />{{ 'in a minute' | t }}</h1>
        <p>{{ 'Find the right specialist, pick a free time and pay online. Your visits, prescriptions and bills stay together in one place.' | t }}</p>

        <form class="hero-search" role="search" (ngSubmit)="searchDoctors()">
          <app-icon name="search" [size]="20" />
          <label for="hero-q" class="sr-only">{{ 'Search doctors or specialties' | t }}</label>
          <input id="hero-q" name="q" type="search" [placeholder]="'Search a doctor or specialty, e.g. dentist' | t" [(ngModel)]="query" autocomplete="off" />
          <button class="btn primary" type="submit">{{ 'Search' | t }}</button>
        </form>

        <div class="hero-actions">
          <a class="btn outline" routerLink="/doctors">{{ 'Browse all doctors' | t }}</a>
          <a class="btn outline" routerLink="/pharmacy">{{ 'Visit the pharmacy' | t }}</a>
          @if (!auth.isLoggedIn()) { <a class="btn outline" routerLink="/register">{{ 'Create an account' | t }}</a> }
        </div>
      </div>
      <div class="hero-visual">
        <div class="hero-logo-ring"><app-logo [size]="170" /></div>
        <ul class="hero-stats">
          <li><strong>{{ doctorCount() || '—' }}</strong><span>{{ 'doctors' | t }}</span></li>
          <li><strong>{{ specializations().length || '—' }}</strong><span>{{ 'specialties' | t }}</span></li>
          <li><strong>24/7</strong><span>{{ 'online booking' | t }}</span></li>
        </ul>
      </div>
    </section>

    <!-- Trust strip -->
    <ul class="trust-strip">
      <li><span class="trust-icon"><app-icon name="shield" /></span><div><strong>{{ 'Verified doctors' | t }}</strong><span>{{ 'Every degree and licence checked' | t }}</span></div></li>
      <li><span class="trust-icon"><app-icon name="card" /></span><div><strong>{{ 'Secure online payment' | t }}</strong><span>{{ 'Full refund up to 2 hours before' | t }}</span></div></li>
      <li><span class="trust-icon"><app-icon name="umbrella" /></span><div><strong>{{ 'Insurance accepted' | t }}</strong><span>{{ 'Your share is taken off automatically' | t }}</span></div></li>
      <li><span class="trust-icon"><app-icon name="bag" /></span><div><strong>{{ 'Pharmacy on site' | t }}</strong><span>{{ 'Order online, collect at the desk' | t }}</span></div></li>
    </ul>

    <!-- Specialties -->
    <section class="home-section">
      <div class="section-head">
        <div>
          <p class="eyebrow">{{ 'Specialties' | t }}</p>
          <h2 class="no-rule">{{ 'Find care by specialty' | t }}</h2>
        </div>
        <a class="see-all" routerLink="/doctors">{{ 'All doctors' | t }} <app-icon name="arrow" [size]="16" /></a>
      </div>
      <div class="specialty-grid">
        @for (s of specializations(); track s.id) {
          <a class="specialty-tile" routerLink="/doctors" [queryParams]="{ specializationId: s.id }">
            <span class="specialty-icon"><app-icon [name]="icon(s.name)" [size]="26" /></span>
            <span class="specialty-text">
              <strong>{{ s.name | t }}</strong>
              <span class="muted small">{{ s.description | t }}</span>
            </span>
          </a>
        }
      </div>
    </section>

    <!-- How it works -->
    <section class="home-band">
      <p class="eyebrow center">{{ 'How it works' | t }}</p>
      <h2 class="no-rule center">{{ 'Three steps to your visit' | t }}</h2>
      <ol class="how-steps">
        <li>
          <span class="step-no">1</span>
          <app-icon name="search" [size]="28" />
          <strong>{{ 'Choose a doctor' | t }}</strong>
          <p class="muted">{{ 'Compare experience, reviews, prices and verified credentials.' | t }}</p>
        </li>
        <li>
          <span class="step-no">2</span>
          <app-icon name="calendar" [size]="28" />
          <strong>{{ 'Pick a time and pay' | t }}</strong>
          <p class="muted">{{ 'See free times instantly. Your insurance share is taken off automatically.' | t }}</p>
        </li>
        <li>
          <span class="step-no">3</span>
          <app-icon name="check" [size]="28" />
          <strong>{{ 'Visit and follow up' | t }}</strong>
          <p class="muted">{{ 'Reminders, records and prescriptions online. Cancel up to 2 hours before for a full refund.' | t }}</p>
        </li>
      </ol>
    </section>

    <!-- Doctors -->
    @if (featured().length > 0) {
      <section class="home-section">
        <div class="section-head">
          <div>
            <p class="eyebrow">{{ 'Our team' | t }}</p>
            <h2 class="no-rule">{{ 'Meet some of our doctors' | t }}</h2>
          </div>
          <a class="see-all" routerLink="/doctors">{{ 'See all' | t }} <app-icon name="arrow" [size]="16" /></a>
        </div>
        <div class="grid">
          @for (doctor of featured(); track doctor.id) {
            <app-doctor-card [doctor]="doctor" />
          }
        </div>
      </section>
    }

    <!-- Services and prices -->
    @if (popularServices().length > 0) {
      <section class="home-section">
        <div class="section-head">
          <div>
            <p class="eyebrow">{{ 'Transparent pricing' | t }}</p>
            <h2 class="no-rule">{{ 'Popular services' | t }}</h2>
          </div>
          <a class="see-all" routerLink="/services">{{ 'All services and prices' | t }} <app-icon name="arrow" [size]="16" /></a>
        </div>
        <ul class="price-list card">
          @for (s of popularServices(); track s.id) {
            <li>
              <div>
                <strong>{{ s.name }}</strong>
                <span class="muted small">{{ s.department | t }} · {{ '{n} min' | t: { n: s.durationMinutes } }}</span>
              </div>
              <span class="price-tag">{{ s.price | currency: 'GEL' : 'symbol-narrow' : '1.0-2' }}</span>
            </li>
          }
        </ul>
      </section>
    }

    <!-- Store -->
    <section class="store-promo home-section">
      <div class="store-promo-text">
        <p class="eyebrow">{{ 'Umbrella pharmacy' | t }}</p>
        <h2 class="no-rule">{{ 'Your pharmacy, ready when you are' | t }}</h2>
        <p class="muted">{{ 'Medicines, vitamins, first aid and everyday care. Pay online and collect at our pharmacy desk. Prescription medicines are available with a prescription from your doctor.' | t }}</p>
        <div class="promo-cats">
          @for (c of categories; track c) {
            <a class="promo-cat" routerLink="/pharmacy" [queryParams]="{ category: c }">{{ info[c].label | t }}</a>
          }
        </div>
        <a class="btn primary" routerLink="/pharmacy">{{ 'Shop now' | t }}</a>
      </div>
      <div class="promo-shelf">
        @for (p of popularProducts(); track p.id) {
          <a class="shelf-item" routerLink="/pharmacy" [queryParams]="{ category: p.category }">
            <app-product-image class="shelf-pic" [attr.data-cat]="p.category" [name]="p.name" [category]="p.category" [imageUrl]="p.imageUrl" />
            <span class="small">{{ p.name }}</span>
            <strong class="small">{{ p.price | currency: 'GEL' : 'symbol-narrow' }}</strong>
          </a>
        }
      </div>
    </section>

    <!-- Closing call to action -->
    <section class="cta-band">
      <div>
        <h2 class="no-rule">{{ 'Ready to book your visit?' | t }}</h2>
        <p>{{ 'Free times are shown instantly. Questions? Press Ask us at the bottom right.' | t }}</p>
      </div>
      <div class="cta-actions">
        <a class="btn primary" routerLink="/doctors">{{ 'Find a doctor' | t }}</a>
        @if (!auth.isLoggedIn()) { <a class="btn outline" routerLink="/register">{{ 'Create an account' | t }}</a> }
      </div>
      <p class="cta-emergency"><app-icon name="phone" [size]="18" /> <span><strong>{{ 'Emergency?' | t }}</strong> {{ 'Call' | t }} <a href="tel:112">112</a>. {{ 'Online booking is not for emergencies.' | t }}</span></p>
    </section>
  `
})
export class HomePage {
  protected readonly auth = inject(AuthService);
  private readonly doctorsApi = inject(DoctorsApi);
  private readonly storeApi = inject(StoreApi);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18n);

  protected readonly info = CATEGORY_INFO;
  protected readonly categories = Object.keys(CATEGORY_INFO) as ProductCategory[];
  protected readonly specializations = signal<Specialization[]>([]);
  protected readonly doctors = signal<DoctorListItem[]>([]);
  protected readonly doctorCount = signal(0);
  protected readonly products = signal<Product[]>([]);
  protected readonly services = signal<ClinicService[]>([]);
  protected query = '';

  // Best rated, then most experienced, one per specialty so the selection feels varied.
  protected readonly featured = computed(() => {
    const seen = new Set<string>();
    return [...this.doctors()]
      .sort((a, b) => b.averageRating - a.averageRating || b.yearsOfExperience - a.yearsOfExperience)
      .filter(d => !seen.has(d.specialization) && !!seen.add(d.specialization))
      .slice(0, 3);
  });

  // The most widely offered services first.
  protected readonly popularServices = computed(() =>
    [...this.services()].sort((a, b) => b.doctors.length - a.doctors.length || a.price - b.price).slice(0, 6));

  protected readonly popularProducts = computed(() =>
    this.products().filter(p => !p.requiresPrescription && p.stock > 0)
      .filter((p, i, all) => all.findIndex(x => x.category === p.category) === i)
      .slice(0, 6));

  constructor() {
    this.doctorsApi.specializations().subscribe({ next: list => this.specializations.set(list) });
    this.doctorsApi.list({ pageSize: 100 }).subscribe({
      next: r => {
        this.doctors.set(r.items);
        this.doctorCount.set(r.totalCount);
      }
    });
    this.storeApi.products().subscribe({ next: list => this.products.set(list) });
    this.http.get<ClinicService[]>('/api/services').subscribe({ next: list => this.services.set(list) });
  }

  protected icon(name: string): string {
    return specialtyIcon(name);
  }

  /** A specialty name opens that specialty; anything else searches doctors by name. */
  protected searchDoctors(): void {
    const q = this.query.trim();
    const lower = q.toLowerCase();
    // Specialty names match in English and in the chosen language.
    const spec = this.specializations().find(s => q.length >= 3 && [s.name, this.i18n.t(s.name)].some(n =>
      n.toLowerCase().includes(lower) || lower.startsWith(n.toLowerCase().slice(0, 5))));
    void this.router.navigate(['/doctors'], { queryParams: spec ? { specializationId: spec.id } : q ? { search: q } : {} });
  }
}
