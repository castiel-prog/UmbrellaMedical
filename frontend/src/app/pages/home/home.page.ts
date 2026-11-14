import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { DoctorsApi } from '../../core/doctors.api';
import { CATEGORY_INFO, StoreApi } from '../../core/store.api';
import { DoctorListItem, Product, ProductCategory, Specialization } from '../../core/model';
import { DoctorCard } from '../../core/doctor-card';
import { Logo } from '../../shared/logo';

const SPECIALTY_ICONS: Record<string, string> = {
  'General Practitioner': '🩺', Dentist: '🦷', Cardiologist: '❤️', Pediatrician: '🧸', Dermatologist: '🧴',
  Radiologist: '🩻', Neurologist: '🧠', Orthopedist: '🦴', Ophthalmologist: '👁️', 'Otolaryngologist (ENT)': '👂',
  Gynecologist: '🌸', Psychiatrist: '💬', Endocrinologist: '🦋', Urologist: '💧'
};

@Component({
  selector: 'app-home',
  imports: [RouterLink, CurrencyPipe, DoctorCard, Logo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="hero">
      <div class="hero-text">
        <p class="hero-kicker">UMBRELLA MEDICAL CENTER · TBILISI</p>
        <h1>Care you can book in a minute</h1>
        <p>Find the right specialist, pick a free time, pay online and keep your visits, prescriptions and bills in one place.</p>
        <div class="hero-actions">
          <a class="btn primary" routerLink="/doctors">Find a doctor</a>
          <a class="btn outline" routerLink="/store">Visit the store</a>
          @if (!auth.isLoggedIn()) {
            <a class="btn outline" routerLink="/register">Create an account</a>
          }
        </div>
        <ul class="hero-stats">
          <li><strong>{{ doctorCount() || '—' }}</strong><span>doctors</span></li>
          <li><strong>{{ specializations().length || '—' }}</strong><span>specialties</span></li>
          <li><strong>24/7</strong><span>online booking</span></li>
        </ul>
      </div>
      <app-logo class="hero-logo" [size]="170" />
    </section>

    <section>
      <div class="section-head">
        <h2>Find care by specialty</h2>
        <a routerLink="/doctors">All doctors →</a>
      </div>
      <div class="specialty-grid">
        @for (s of specializations(); track s.id) {
          <a class="specialty-tile" routerLink="/doctors" [queryParams]="{ specializationId: s.id }">
            <span class="specialty-icon" aria-hidden="true">{{ icon(s.name) }}</span>
            <strong>{{ s.name }}</strong>
            <span class="muted small">{{ s.description }}</span>
          </a>
        }
      </div>
    </section>

    <section>
      <h2>How it works</h2>
      <ol class="how-steps">
        <li><span class="step-no">1</span><div><strong>Choose a doctor</strong><p class="muted">Compare experience, reviews, prices and verified credentials.</p></div></li>
        <li><span class="step-no">2</span><div><strong>Pick a time and pay</strong><p class="muted">See free times instantly. Your insurance share is taken off automatically.</p></div></li>
        <li><span class="step-no">3</span><div><strong>Visit and follow up</strong><p class="muted">Get reminders, records and prescriptions online. Cancel up to 2 hours before for a full refund.</p></div></li>
      </ol>
    </section>

    @if (featured().length > 0) {
      <section>
        <div class="section-head">
          <h2>Meet some of our doctors</h2>
          <a routerLink="/doctors">See all →</a>
        </div>
        <div class="grid">
          @for (doctor of featured(); track doctor.id) {
            <app-doctor-card [doctor]="doctor" />
          }
        </div>
      </section>
    }

    <section class="store-promo">
      <div class="store-promo-text">
        <h2>The Umbrella store</h2>
        <p>Medicines, vitamins, first aid and everyday care. Pay online and collect at our pharmacy desk.
           Prescription medicines are available with a prescription from your doctor.</p>
        <a class="btn primary" routerLink="/store">Shop now</a>
      </div>
      <div class="promo-cats">
        @for (c of categories; track c) {
          <a class="promo-cat" routerLink="/store" [queryParams]="{ category: c }">
            <span aria-hidden="true">{{ info[c].icon }}</span>{{ info[c].label }}
          </a>
        }
      </div>
      @if (popular().length > 0) {
        <ul class="promo-products">
          @for (p of popular(); track p.id) {
            <li><span aria-hidden="true">{{ info[p.category].icon }}</span> {{ p.name }} <strong>{{ p.price | currency: 'GEL' : 'symbol-narrow' }}</strong></li>
          }
        </ul>
      }
    </section>

    <section class="help-strip">
      <div>
        <h3>Questions?</h3>
        <p class="muted">Press <strong>💬 Ask us</strong> at the bottom right. Our assistant knows our doctors, prices, booking and the store.</p>
      </div>
      <div class="emergency-note" role="note">
        <strong>Emergency?</strong> Call <a href="tel:112">112</a>. Online booking is not for emergencies.
      </div>
    </section>
  `
})
export class HomePage {
  protected readonly auth = inject(AuthService);
  private readonly doctorsApi = inject(DoctorsApi);
  private readonly storeApi = inject(StoreApi);

  protected readonly info = CATEGORY_INFO;
  protected readonly categories = Object.keys(CATEGORY_INFO) as ProductCategory[];
  protected readonly specializations = signal<Specialization[]>([]);
  protected readonly doctors = signal<DoctorListItem[]>([]);
  protected readonly doctorCount = signal(0);
  protected readonly products = signal<Product[]>([]);

  // Most experienced first, one per specialty, so the selection feels varied.
  protected readonly featured = computed(() => {
    const seen = new Set<string>();
    return [...this.doctors()]
      .sort((a, b) => b.averageRating - a.averageRating || b.yearsOfExperience - a.yearsOfExperience)
      .filter(d => !seen.has(d.specialization) && seen.add(d.specialization))
      .slice(0, 3);
  });

  protected readonly popular = computed(() =>
    this.products().filter(p => !p.requiresPrescription && p.stock > 0).slice(0, 6));

  constructor() {
    this.doctorsApi.specializations().subscribe({ next: list => this.specializations.set(list) });
    this.doctorsApi.list({ pageSize: 100 }).subscribe({
      next: r => {
        this.doctors.set(r.items);
        this.doctorCount.set(r.totalCount);
      }
    });
    this.storeApi.products().subscribe({ next: list => this.products.set(list) });
  }

  protected icon(name: string): string {
    return SPECIALTY_ICONS[name] ?? '🏥';
  }
}
