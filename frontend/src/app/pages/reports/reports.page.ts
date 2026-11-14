import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AdminApi } from '../../core/admin.api';
import { DoctorReportRow, ReportSummary, RevenueReport, RevenueRow, ServiceReportRow } from '../../core/model';
import { apiErrorMessage } from '../../core/api-error';
import { addDays, saveDownload, splitWords, toDateInput } from '../../core/util';

type Measure = 'collected' | 'billed';

@Component({
  selector: 'app-reports',
  imports: [FormsModule, RouterLink, CurrencyPipe, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head">
      <h1>Reports</h1>
      <button class="btn small" type="button" (click)="export()" [disabled]="exporting() || loading()">
        {{ exporting() ? 'Exporting...' : 'Export revenue CSV' }}
      </button>
    </div>

    <form class="filters" (ngSubmit)="load()">
      <div class="field"><label for="rp-from">From</label><input id="rp-from" name="from" type="date" [(ngModel)]="from" (change)="load()" /></div>
      <div class="field"><label for="rp-to">To</label><input id="rp-to" name="to" type="date" [(ngModel)]="to" (change)="load()" /></div>
      <div class="field">
        <label for="rp-group">Group revenue by</label>
        <select id="rp-group" name="group" [(ngModel)]="groupBy" (ngModelChange)="load()">
          <option value="day">Day</option>
          <option value="month">Month</option>
        </select>
      </div>
      <div class="field">
        <label for="rp-range">Quick range</label>
        <select id="rp-range" name="range" (change)="quick($any($event.target).value)">
          <option value="">Choose…</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="365">Last 12 months</option>
        </select>
      </div>
    </form>

    @if (error()) { <p class="alert error" role="alert">{{ error() }}</p> }
    @if (loading() && !summary()) { <p class="muted">Loading...</p> }

    @if (summary(); as s) {
      <div [class.dim]="loading()">
        <h2>Visits</h2>
        <div class="stat-grid">
          <div class="stat"><span>Total visits</span><strong>{{ s.appointments.total | number }}</strong></div>
          <div class="stat"><span>Completed</span><strong>{{ s.appointments.completed | number }}</strong></div>
          <div class="stat"><span>Scheduled</span><strong>{{ s.appointments.scheduled | number }}</strong></div>
          <div class="stat"><span>Cancelled</span><strong>{{ s.appointments.cancelled | number }}</strong></div>
          <div class="stat"><span>Missed</span><strong>{{ s.appointments.noShow | number }}</strong></div>
          <div class="stat"><span>New patients</span><strong>{{ s.newPatients | number }}</strong></div>
          <div class="stat"><span>Active doctors</span><strong>{{ s.activeDoctors | number }}</strong></div>
          <div class="stat"><span>Average doctor rating</span><strong>{{ s.averageDoctorRating | number: '1.1-1' }} ★</strong></div>
        </div>

        <h2>Money</h2>
        <div class="stat-grid">
          <div class="stat"><span>Billed</span><strong>{{ s.billed | currency: 'GEL' : 'symbol-narrow' : '1.0-0' }}</strong></div>
          <div class="stat"><span>Insurance share</span><strong>{{ s.insuranceShare | currency: 'GEL' : 'symbol-narrow' : '1.0-0' }}</strong></div>
          <div class="stat"><span>Patient share</span><strong>{{ s.patientShare | currency: 'GEL' : 'symbol-narrow' : '1.0-0' }}</strong></div>
          <div class="stat"><span>Collected</span><strong>{{ s.collected | currency: 'GEL' : 'symbol-narrow' : '1.0-0' }}</strong></div>
          <div class="stat"><span>Refunded</span><strong>{{ s.refunded | currency: 'GEL' : 'symbol-narrow' : '1.0-0' }}</strong></div>
          <div class="stat"><span>Outstanding balance</span><strong>{{ s.outstandingBalance | currency: 'GEL' : 'symbol-narrow' : '1.0-0' }}</strong></div>
        </div>

        @if (revenue(); as rev) {
          <div class="page-head section-gap">
            <h2>Revenue by {{ rev.groupBy }}</h2>
            <div class="tabs compact" role="tablist" aria-label="Measure">
              <button type="button" role="tab" [class.active]="measure() === 'collected'" [attr.aria-selected]="measure() === 'collected'" (click)="measure.set('collected')">Collected</button>
              <button type="button" role="tab" [class.active]="measure() === 'billed'" [attr.aria-selected]="measure() === 'billed'" (click)="measure.set('billed')">Billed</button>
            </div>
          </div>

          @if (rev.rows.length === 0) {
            <p class="empty card muted">No invoices or payments in this period.</p>
          } @else {
            <figure class="card chart" [attr.aria-label]="(measure() === 'collected' ? 'Collected' : 'Billed') + ' per ' + rev.groupBy">
              <div class="chart-plot">
                <div class="chart-axis" aria-hidden="true">
                  <span>{{ maxValue() | currency: 'GEL' : 'symbol-narrow' : '1.0-0' }}</span>
                  <span>{{ maxValue() / 2 | currency: 'GEL' : 'symbol-narrow' : '1.0-0' }}</span>
                  <span>0</span>
                </div>
                <div class="chart-bars">
                  @for (r of rev.rows; track r.period) {
                    <button type="button" class="chart-col"
                      [attr.aria-label]="r.period + ': ' + (value(r) | currency: 'GEL' : 'symbol-narrow')"
                      (mouseenter)="hover.set(r)" (focus)="hover.set(r)" (mouseleave)="hover.set(null)" (blur)="hover.set(null)">
                      <span class="chart-fill" [style.height.%]="pct(r)"></span>
                      @if (hover() === r) {
                        <span class="chart-tip" role="tooltip">
                          <strong>{{ r.period }}</strong>
                          <span>{{ measure() === 'collected' ? 'Collected' : 'Billed' }}: {{ value(r) | currency: 'GEL' : 'symbol-narrow' }}</span>
                          <span class="muted">{{ r.invoices }} invoice(s)</span>
                        </span>
                      }
                    </button>
                  }
                </div>
              </div>
              <figcaption class="chart-x muted">
                <span>{{ rev.rows[0].period }}</span>
                <span>{{ rev.rows[rev.rows.length - 1].period }}</span>
              </figcaption>
            </figure>

            <details class="section-gap">
              <summary>Show as table</summary>
              <div class="table-wrap">
                <table class="table">
                  <thead><tr><th>Period</th><th class="right">Invoices</th><th class="right">Billed</th><th class="right">Insurance</th><th class="right">Patient</th><th class="right">Collected</th></tr></thead>
                  <tbody>
                    @for (r of rev.rows; track r.period) {
                      <tr>
                        <td>{{ r.period }}</td>
                        <td class="right">{{ r.invoices }}</td>
                        <td class="right">{{ r.billed | currency: 'GEL' : 'symbol-narrow' }}</td>
                        <td class="right">{{ r.insuranceShare | currency: 'GEL' : 'symbol-narrow' }}</td>
                        <td class="right">{{ r.patientShare | currency: 'GEL' : 'symbol-narrow' }}</td>
                        <td class="right">{{ r.collected | currency: 'GEL' : 'symbol-narrow' }}</td>
                      </tr>
                    }
                    <tr class="total-row">
                      <td>Total</td>
                      <td class="right">{{ rev.totals.invoices }}</td>
                      <td class="right">{{ rev.totals.billed | currency: 'GEL' : 'symbol-narrow' }}</td>
                      <td class="right">{{ rev.totals.insuranceShare | currency: 'GEL' : 'symbol-narrow' }}</td>
                      <td class="right">{{ rev.totals.patientShare | currency: 'GEL' : 'symbol-narrow' }}</td>
                      <td class="right">{{ rev.totals.collected | currency: 'GEL' : 'symbol-narrow' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </details>
          }

          @if (rev.byMethod.length > 0) {
            <h2>Payments by method</h2>
            <div class="table-wrap">
              <table class="table">
                <thead><tr><th>Method</th><th class="right">Payments</th><th class="right">Amount</th></tr></thead>
                <tbody>
                  @for (m of rev.byMethod; track m.method) {
                    <tr><td>{{ words(m.method) }}</td><td class="right">{{ m.payments }}</td><td class="right">{{ m.amount | currency: 'GEL' : 'symbol-narrow' }}</td></tr>
                  }
                </tbody>
              </table>
            </div>
          }
        }

        <h2>Visits by doctor</h2>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Doctor</th><th class="right">Total</th><th class="right">Completed</th><th class="right">Scheduled</th><th class="right">Cancelled</th><th class="right">Missed</th><th class="right">Billed</th></tr></thead>
            <tbody>
              @for (d of doctors(); track d.doctorId) {
                <tr>
                  <td><a [routerLink]="['/doctors', d.doctorId]">Dr. {{ d.doctorName }}</a> <span class="muted small">{{ d.specialization }}</span></td>
                  <td class="right">{{ d.total }}</td>
                  <td class="right">{{ d.completed }}</td>
                  <td class="right">{{ d.scheduled }}</td>
                  <td class="right">{{ d.cancelled }}</td>
                  <td class="right">{{ d.noShow }}</td>
                  <td class="right">{{ d.billed | currency: 'GEL' : 'symbol-narrow' }}</td>
                </tr>
              } @empty {
                <tr><td colspan="7" class="muted">No data.</td></tr>
              }
            </tbody>
          </table>
        </div>

        <h2>Most popular services</h2>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Service</th><th>Department</th><th class="right">Visits</th><th class="right">Billed</th></tr></thead>
            <tbody>
              @for (sv of services(); track sv.serviceId) {
                <tr>
                  <td>{{ sv.serviceName }}</td>
                  <td>{{ sv.department }}</td>
                  <td class="right">{{ sv.appointments }}</td>
                  <td class="right">{{ sv.billed | currency: 'GEL' : 'symbol-narrow' }}</td>
                </tr>
              } @empty {
                <tr><td colspan="4" class="muted">No data.</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }
  `
})
export class ReportsPage {
  private readonly api = inject(AdminApi);

  protected readonly words = splitWords;
  protected from = toDateInput(addDays(new Date(), -29));
  protected to = toDateInput(new Date());
  protected groupBy: 'day' | 'month' = 'day';

  protected readonly summary = signal<ReportSummary | null>(null);
  protected readonly revenue = signal<RevenueReport | null>(null);
  protected readonly doctors = signal<DoctorReportRow[]>([]);
  protected readonly services = signal<ServiceReportRow[]>([]);
  protected readonly loading = signal(true);
  protected readonly exporting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly measure = signal<Measure>('collected');
  protected readonly hover = signal<RevenueRow | null>(null);

  protected readonly maxValue = computed(() => {
    const rows = this.revenue()?.rows ?? [];
    const max = Math.max(0, ...rows.map(r => this.value(r)));
    return max === 0 ? 1 : niceCeiling(max);
  });

  constructor() {
    this.load();
  }

  protected value(r: RevenueRow): number {
    return this.measure() === 'collected' ? r.collected : r.billed;
  }

  protected pct(r: RevenueRow): number {
    return (this.value(r) / this.maxValue()) * 100;
  }

  protected quick(days: string): void {
    const n = Number(days);
    if (!n) return;
    this.from = toDateInput(addDays(new Date(), -(n - 1)));
    this.to = toDateInput(new Date());
    this.groupBy = n > 90 ? 'month' : 'day';
    this.load();
  }

  protected load(): void {
    if (!this.from || !this.to || this.from > this.to) {
      this.error.set('"From" must be on or before "To".');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      summary: this.api.summary(this.from, this.to),
      revenue: this.api.revenue(this.from, this.to, this.groupBy),
      doctors: this.api.byDoctor(this.from, this.to),
      services: this.api.popularServices(this.from, this.to, 10)
    }).subscribe({
      next: r => {
        this.summary.set(r.summary);
        this.revenue.set(r.revenue);
        this.doctors.set(r.doctors);
        this.services.set(r.services);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(apiErrorMessage(err));
        this.loading.set(false);
      }
    });
  }

  protected export(): void {
    this.exporting.set(true);
    this.api.exportRevenue(this.from, this.to, this.groupBy).subscribe({
      next: response => {
        this.exporting.set(false);
        saveDownload(response, `revenue-${this.from}-${this.to}.csv`);
      },
      error: err => {
        this.exporting.set(false);
        this.error.set(apiErrorMessage(err));
      }
    });
  }
}

/** Rounds up to 1, 2 or 5 × a power of ten so the axis labels stay readable. */
function niceCeiling(value: number): number {
  const power = Math.pow(10, Math.floor(Math.log10(value)));
  for (const step of [1, 2, 5, 10]) {
    if (value <= step * power) return step * power;
  }
  return 10 * power;
}
