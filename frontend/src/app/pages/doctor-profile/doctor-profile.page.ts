import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DoctorsApi } from '../../core/doctors.api';
import { AuthService } from '../../core/auth.service';
import { DoctorDetails, Review, ReviewSummary } from '../../core/model';
import { apiErrorMessage } from '../../core/api-error';
import { StarRating } from '../../core/star-rating';
import { Certificate } from '../../shared/certificate';
import { LocalDatePipe, TranslatePipe } from '../../core/i18n';

@Component({
  selector: 'app-doctor-profile',
  imports: [TranslatePipe, LocalDatePipe, RouterLink, CurrencyPipe, StarRating, Certificate],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="back" routerLink="/doctors">← {{ 'All doctors' | t }}</a>

    @if (error()) {
      <p class="alert error" role="alert">{{ error() | t }}</p>
    }

    @if (doctor(); as d) {
      <section class="card profile-head">
        @if (d.photoUrl; as photo) {
          <img class="avatar big" [src]="photo" alt="" />
        } @else {
          <div class="avatar big" aria-hidden="true">{{ initials() }}</div>
        }
        <div class="profile-main">
          <h1>{{ 'Dr. {name}' | t: { name: d.firstName + ' ' + d.lastName } }}</h1>
          <p class="spec">{{ d.specialization | t }}</p>
          <p class="muted">{{ '{n} years of experience' | t: { n: d.yearsOfExperience } }}</p>
          @if (d.reviewCount > 0) {
            <app-star-rating [value]="d.averageRating" [count]="d.reviewCount" />
          } @else {
            <span class="muted">{{ 'No reviews yet' | t }}</span>
          }
        </div>
        <div class="profile-actions">
          <a class="btn primary" [routerLink]="['/book', d.id]">{{ 'Book a visit' | t }}</a>
          @if (isPatient()) {
            <a class="btn" routerLink="/health" [queryParams]="{ tab: 'prescriptions', request: 1, doctorId: d.id }">{{ 'Request a prescription' | t }}</a>
          }
        </div>
      </section>

      @if (d.bio) {
        <h2>{{ 'About' | t }}</h2>
        <p class="pre-line">{{ d.bio }}</p>
      }

      <ul class="highlights">
        <li><strong>{{ d.yearsOfExperience }}+</strong><span>{{ 'years caring for patients' | t }}</span></li>
        <li><strong>✓</strong><span>{{ 'Licensed and credentials verified' | t }}</span></li>
        <li><strong>{{ d.services.length }}</strong><span>{{ (d.services.length === 1 ? 'service offered' : 'services offered') | t }}</span></li>
        @if (d.reviewCount > 0) {
          <li><strong>{{ d.averageRating.toFixed(1) }} ★</strong><span>{{ (d.reviewCount === 1 ? 'from 1 patient review' : 'from {n} patient reviews') | t: { n: d.reviewCount } }}</span></li>
        }
      </ul>

      <h2>{{ 'Credentials' | t }}</h2>
      <p class="muted">{{ 'Every Umbrella doctor\\'s degree and licence is checked by our Credentialing Office.' | t }}</p>
      <div class="certificates">
        <app-certificate kind="excellence" [doctor]="d" />
        @for (e of d.educations; track $index) {
          <app-certificate kind="degree" [doctor]="d" [education]="e" />
        }
      </div>

      <h2>{{ 'Services and prices' | t }}</h2>
      @if (d.services.length === 0) {
        <p class="muted">{{ 'This doctor has no services yet.' | t }}</p>
      } @else {
        <div class="table-wrap">
          <table class="table services-table">
            <thead>
              <tr><th>{{ 'Service' | t }}</th><th>{{ 'Duration' | t }}</th><th>{{ 'Price' | t }}</th><th></th></tr>
            </thead>
            <tbody>
              @for (s of d.services; track s.serviceId) {
                <tr>
                  <td>{{ s.name }}<span class="muted small only-phone"> · {{ '{n} min' | t: { n: s.durationMinutes } }}</span></td>
                  <td>{{ '{n} min' | t: { n: s.durationMinutes } }}</td>
                  <td>{{ s.price | currency: 'GEL' : 'symbol-narrow' }}</td>
                  <td class="right">
                    <a class="btn small" [routerLink]="['/book', d.id]" [queryParams]="{ serviceId: s.serviceId }">{{ 'Book' | t }}</a>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <div class="two-col">
        <div>
          <h2>{{ 'Education' | t }}</h2>
          @if (d.educations.length === 0) {
            <p class="muted">{{ 'Not added yet.' | t }}</p>
          } @else {
            <ul class="timeline">
              @for (e of d.educations; track $index) {
                <li>
                  <strong>{{ e.degree }}</strong>
                  <span>{{ e.institution }}</span>
                  <small class="muted">{{ e.startYear }} – {{ e.graduationYear }}</small>
                </li>
              }
            </ul>
          }
        </div>
        <div>
          <h2>{{ 'Experience' | t }}</h2>
          @if (d.experiences.length === 0) {
            <p class="muted">{{ 'Not added yet.' | t }}</p>
          } @else {
            <ul class="timeline">
              @for (x of d.experiences; track $index) {
                <li>
                  <strong>{{ x.position }}</strong>
                  <span>{{ x.workplace }}</span>
                  <small class="muted">{{ x.startDate | ldate: 'monthYear' }} – {{ x.endDate ? (x.endDate | ldate: 'monthYear') : ('now' | t) }}</small>
                  @if (x.description) {
                    <p class="muted">{{ x.description }}</p>
                  }
                </li>
              }
            </ul>
          }
        </div>
      </div>

      <h2>{{ 'Reviews' | t }}</h2>
      @if (summary(); as sum) {
        @if (sum.reviewCount === 0) {
          <p class="muted">{{ 'No reviews yet. Patients can review a doctor after a completed visit.' | t }}</p>
        } @else {
          <div class="card review-summary">
            <div class="score">
              <strong>{{ sum.averageRating.toFixed(1) }}</strong>
              <app-star-rating [value]="sum.stars" />
              <span class="muted">{{ (sum.reviewCount === 1 ? '1 review' : '{n} reviews') | t: { n: sum.reviewCount } }}</span>
            </div>
            <div class="bars">
              @for (row of distribution(); track row.rating) {
                <div class="bar-row">
                  <span>{{ row.rating }} ★</span>
                  <div class="bar"><div class="fill" [style.width.%]="row.percent"></div></div>
                  <span class="muted">{{ row.count }}</span>
                </div>
              }
            </div>
          </div>

          <ul class="review-list">
            @for (r of reviews(); track r.id) {
              <li class="card">
                <div class="review-head">
                  <strong>{{ r.authorName }}</strong>
                  <app-star-rating [value]="r.rating" />
                </div>
                @if (r.comment) {
                  <p>{{ r.comment }}</p>
                }
                <small class="muted">{{ r.createdAt | ldate: 'medium' }}</small>
              </li>
            }
          </ul>

          @if (reviews().length < reviewTotal()) {
            <button class="btn" type="button" (click)="loadMoreReviews()" [disabled]="loadingReviews()">
              {{ (loadingReviews() ? 'Loading...' : 'Show more reviews') | t }}
            </button>
          }
        }
      }
    } @else if (!error()) {
      <p class="muted">{{ 'Loading doctor...' | t }}</p>
    }
  `
})
export class DoctorProfilePage {
  private readonly api = inject(DoctorsApi);
  private readonly auth = inject(AuthService);
  private readonly id = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));

  protected readonly isPatient = computed(() => this.auth.hasRole('Patient'));

  protected readonly doctor = signal<DoctorDetails | null>(null);
  protected readonly summary = signal<ReviewSummary | null>(null);
  protected readonly reviews = signal<Review[]>([]);
  protected readonly reviewTotal = signal(0);
  protected readonly loadingReviews = signal(false);
  protected readonly error = signal<string | null>(null);
  private reviewPage = 1;

  protected readonly initials = computed(() => {
    const d = this.doctor();
    return d ? `${d.firstName.charAt(0)}${d.lastName.charAt(0)}`.toUpperCase() : '';
  });

  protected readonly distribution = computed(() => {
    const sum = this.summary();
    if (!sum) return [];
    return [5, 4, 3, 2, 1].map(rating => {
      const count = sum.distribution.find(x => x.rating === rating)?.count ?? 0;
      return { rating, count, percent: sum.reviewCount ? (count * 100) / sum.reviewCount : 0 };
    });
  });

  constructor() {
    this.api.get(this.id).subscribe({
      next: d => this.doctor.set(d),
      error: err => this.error.set(apiErrorMessage(err))
    });
    this.loadReviews();
  }

  protected loadMoreReviews(): void {
    this.reviewPage++;
    this.loadReviews();
  }

  private loadReviews(): void {
    this.loadingReviews.set(true);
    this.api.reviews(this.id, this.reviewPage).subscribe({
      next: data => {
        this.summary.set(data.summary);
        this.reviews.update(list => [...list, ...data.reviews.items]);
        this.reviewTotal.set(data.reviews.totalCount);
        this.loadingReviews.set(false);
      },
      error: () => this.loadingReviews.set(false)
    });
  }
}