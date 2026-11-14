import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DoctorsApi } from '../../core/doctors.api';
import { DoctorDetails, Review, ReviewSummary } from '../../core/model';
import { apiErrorMessage } from '../../core/api-error';
import { StarRating } from '../../core/star-rating';

@Component({
  selector: 'app-doctor-profile',
  imports: [RouterLink, DatePipe, CurrencyPipe, StarRating],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="back" routerLink="/doctors">← All doctors</a>

    @if (error()) {
      <p class="alert error" role="alert">{{ error() }}</p>
    }

    @if (doctor(); as d) {
      <section class="card profile-head">
        @if (d.photoUrl; as photo) {
          <img class="avatar big" [src]="photo" alt="" />
        } @else {
          <div class="avatar big" aria-hidden="true">{{ initials() }}</div>
        }
        <div class="profile-main">
          <h1>Dr. {{ d.firstName }} {{ d.lastName }}</h1>
          <p class="spec">{{ d.specialization }}</p>
          <p class="muted">{{ d.yearsOfExperience }} years of experience</p>
          @if (d.reviewCount > 0) {
            <app-star-rating [value]="d.averageRating" [count]="d.reviewCount" />
          } @else {
            <span class="muted">No reviews yet</span>
          }
        </div>
        <a class="btn primary" [routerLink]="['/book', d.id]">Book a visit</a>
      </section>

      @if (d.bio) {
        <h2>About</h2>
        <p class="pre-line">{{ d.bio }}</p>
      }

      <h2>Services and prices</h2>
      @if (d.services.length === 0) {
        <p class="muted">This doctor has no services yet.</p>
      } @else {
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr><th>Service</th><th>Duration</th><th>Price</th><th></th></tr>
            </thead>
            <tbody>
              @for (s of d.services; track s.serviceId) {
                <tr>
                  <td>{{ s.name }}</td>
                  <td>{{ s.durationMinutes }} min</td>
                  <td>{{ s.price | currency: 'GEL' : 'symbol-narrow' }}</td>
                  <td class="right">
                    <a class="btn small" [routerLink]="['/book', d.id]" [queryParams]="{ serviceId: s.serviceId }">Book</a>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <div class="two-col">
        <div>
          <h2>Education</h2>
          @if (d.educations.length === 0) {
            <p class="muted">Not added yet.</p>
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
          <h2>Experience</h2>
          @if (d.experiences.length === 0) {
            <p class="muted">Not added yet.</p>
          } @else {
            <ul class="timeline">
              @for (x of d.experiences; track $index) {
                <li>
                  <strong>{{ x.position }}</strong>
                  <span>{{ x.workplace }}</span>
                  <small class="muted">{{ x.startDate | date: 'MMM y' }} – {{ x.endDate ? (x.endDate | date: 'MMM y') : 'now' }}</small>
                  @if (x.description) {
                    <p class="muted">{{ x.description }}</p>
                  }
                </li>
              }
            </ul>
          }
        </div>
      </div>

      <h2>Reviews</h2>
      @if (summary(); as sum) {
        @if (sum.reviewCount === 0) {
          <p class="muted">No reviews yet. Patients can review a doctor after a completed visit.</p>
        } @else {
          <div class="card review-summary">
            <div class="score">
              <strong>{{ sum.averageRating.toFixed(1) }}</strong>
              <app-star-rating [value]="sum.stars" />
              <span class="muted">{{ sum.reviewCount }} review(s)</span>
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
                <small class="muted">{{ r.createdAt | date: 'mediumDate' }}</small>
              </li>
            }
          </ul>

          @if (reviews().length < reviewTotal()) {
            <button class="btn" type="button" (click)="loadMoreReviews()" [disabled]="loadingReviews()">
              {{ loadingReviews() ? 'Loading...' : 'Show more reviews' }}
            </button>
          }
        }
      }
    } @else if (!error()) {
      <p class="muted">Loading doctor...</p>
    }
  `
})
export class DoctorProfilePage {
  private readonly api = inject(DoctorsApi);
  private readonly id = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));

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