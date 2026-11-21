import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminApi } from '../../core/admin.api';
import { AdminReview, PagedResult } from '../../core/model';
import { apiErrorMessage } from '../../core/api-error';
import { StarRating } from '../../core/star-rating';
import { LocalDatePipe, TranslatePipe } from '../../core/i18n';
import { Pager } from '../../shared/pager';

@Component({
  selector: 'app-admin-reviews',
  imports: [LocalDatePipe, TranslatePipe, FormsModule, RouterLink, StarRating, Pager],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="filters">
      <div class="field">
        <label for="rv-filter">{{ 'Show' | t }}</label>
        <select id="rv-filter" [(ngModel)]="isApproved" (ngModelChange)="page.set(1); load()">
          <option [ngValue]="null">{{ 'All reviews' | t }}</option>
          <option [ngValue]="true">{{ 'Visible' | t }}</option>
          <option [ngValue]="false">{{ 'Hidden' | t }}</option>
        </select>
      </div>
    </div>

    @if (error()) { <p class="alert error" role="alert">{{ error() }}</p> }

    @if (result(); as data) {
      @if (data.items.length === 0) { <p class="empty card muted">{{ 'No reviews.' | t }}</p> }
      <ul class="stack" [class.dim]="loading()">
        @for (r of data.items; track r.id) {
          <li class="card" [class.dim]="!r.isApproved">
            <div class="row-head">
              <div>
                <app-star-rating [value]="r.rating" />
                <p class="muted">
                  <a [routerLink]="['/doctors', r.doctorId]">{{ 'Dr. {p0}' | t: { p0: (r.doctorName) } }}</a>
                  {{ '· by' | t }} {{ r.patientName }} · {{ r.createdAt | ldate: 'medium' }}
                </p>
              </div>
              <button class="btn small" [class.danger]="r.isApproved" type="button" (click)="toggle(r)" [disabled]="busy() === r.id">
                {{ (r.isApproved ? 'Hide' : 'Show') | t }}
              </button>
            </div>
            @if (r.comment) { <p class="pre-line">{{ r.comment }}</p> }
          </li>
        }
      </ul>
      <app-pager [page]="page()" [pageSize]="pageSize" [totalCount]="data.totalCount" [disabled]="loading()" (pageChange)="page.set($event); load()" />
    } @else if (loading()) {
      <p class="muted">{{ 'Loading...' | t }}</p>
    }
  `
})
export class AdminReviewsTab {
  private readonly api = inject(AdminApi);

  protected readonly pageSize = 15;
  protected readonly page = signal(1);
  protected readonly result = signal<PagedResult<AdminReview> | null>(null);
  protected readonly loading = signal(true);
  protected readonly busy = signal<number | null>(null);
  protected readonly error = signal<string | null>(null);
  protected isApproved: boolean | null = null;

  constructor() {
    this.load();
  }

  protected toggle(r: AdminReview): void {
    this.busy.set(r.id);
    this.api.setReviewVisibility(r.id, !r.isApproved).subscribe({
      next: () => {
        this.busy.set(null);
        this.load();
      },
      error: err => {
        this.busy.set(null);
        this.error.set(apiErrorMessage(err));
      }
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.api.reviews({ isApproved: this.isApproved, page: this.page(), pageSize: this.pageSize }).subscribe({
      next: r => {
        this.result.set(r);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(apiErrorMessage(err));
        this.loading.set(false);
      }
    });
  }
}
