import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AdminApi } from '../../core/admin.api';
import { DoctorReportRow, ReportSummary, RevenueReport, RevenueRow, ServiceReportRow } from '../../core/model';
import { apiErrorMessage } from '../../core/api-error';
import { I18n, LocalDatePipe, TranslatePipe } from '../../core/i18n';
import { DatePicker } from '../../shared/date-picker';
import { addDays, saveDownload, splitWords, toDateInput } from '../../core/util';

type Measure = 'collected' | 'billed';
type PresetId = 'today' | '7' | '30' | 'thisMonth' | 'lastMonth' | '90' | 'thisYear' | '365';

@Component({
  selector: 'app-reports',
  imports: [TranslatePipe, LocalDatePipe, FormsModule, RouterLink, CurrencyPipe, DecimalPipe, DatePicker],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head">
      <h1>{{ 'Reports' | t }}</h1>
      <button class="btn small" type="button" (click)="export()" [disabled]="exporting() || loading()">
        {{ (exporting() ? 'Exporting...' : 'Export revenue CSV') | t }}
      </button>
    </div>

    <!-- Period: one-tap presets, or pick any range in the calendar -->
    <section class="card range-card">
      <div class="range-presets" role="group" [attr.aria-label]="'Quick date ranges' | t">
        @for (p of presets; track p.id) {
          <button type="button" class="chip-btn" [class.on]="preset() === p.id" [attr.aria-pressed]="preset() === p.id" (click)="applyPreset(p.id)">{{ p.label | t }}</button>
        }
      </div>
      <div class="range-fields">
        <div class="field">
          <label for="rp-from">{{ 'From' | t }}</label>
          <app-date-picker inputId="rp-from" [(ngModel)]="from" [max]="to || today" placeholder="Select a date" (ngModelChange)="custom()" />
        </div>
        <span class="range-arrow" aria-hidden="true">→</span>
        <div class="field">
          <label for="rp-to">{{ 'To' | t }}</label>
          <app-date-picker inputId="rp-to" [(ngModel)]="to" [min]="from" [max]="today" placeholder="Select a date" (ngModelChange)="custom()" />
        </div>
        <fieldset class="field range-group">
          <legend>{{ 'Group revenue by' | t }}</legend>
          <div class="segmented" role="radiogroup">
            <label [class.on]="groupBy === 'day'"><input type="radio" name="rp-group" value="day" [checked]="groupBy === 'day'" (change)="setGroup('day')" /> {{ 'Day' | t }}</label>
            <label [class.on]="groupBy === 'month'"><input type="radio" name="rp-group" value="month" [checked]="groupBy === 'month'" (change)="setGroup('month')" /> {{ 'Month' | t }}</label>
          </div>
        </fieldset>
      </div>
      @if (from && to) {
        <p class="range-summary">📅 {{ from | ldate: 'medium' }} – {{ to | ldate: 'medium' }} · {{ '{n} days' | t: { n: dayCount() } }}</p>
      }
    </section>

    @if (error()) { <p class="alert error" role="alert">{{ error() }}</p> }
    @if (loading() && !summary()) { <p class="muted">{{ 'Loading...' | t }}</p> }

    @if (summary(); as s) {
      <div [class.dim]="loading()">
        <h2>{{ 'Visits' | t }}</h2>
        <div class="stat-grid">
          <div class="stat"><span>{{ 'Total visits' | t }}</span><strong>{{ s.appointments.total | number }}</strong></div>
          <div class="stat"><span>{{ 'Completed' | t }}</span><strong>{{ s.appointments.completed | number }}</strong></div>
          <div class="stat"><span>{{ 'Scheduled' | t }}</span><strong>{{ s.appointments.scheduled | number }}</strong></div>
          <div class="stat"><span>{{ 'Cancelled' | t }}</span><strong>{{ s.appointments.cancelled | number }}</strong></div>
          <div class="stat"><span>{{ 'Missed' | t }}</span><strong>{{ s.appointments.noShow | number }}</strong></div>
          <div class="stat"><span>{{ 'New patients' | t }}</span><strong>{{ s.newPatients | number }}</strong></div>
          <div class="stat"><span>{{ 'Active doctors' | t }}</span><strong>{{ s.activeDoctors | number }}</strong></div>
          <div class="stat"><span>{{ 'Average doctor rating' | t }}</span><strong>{{ s.averageDoctorRating | number: '1.1-1' }} ★</strong></div>
        </div>

        <h2>{{ 'Money' | t }}</h2>
        <div class="stat-grid">
          <div class="stat"><span>{{ 'Billed' | t }}</span><strong>{{ s.billed | currency: 'GEL' : 'symbol-narrow' : '1.0-0' }}</strong></div>
          <div class="stat"><span>{{ 'Insurance share' | t }}</span><strong>{{ s.insuranceShare | currency: 'GEL' : 'symbol-narrow' : '1.0-0' }}</strong></div>
          <div class="stat"><span>{{ 'Patient share' | t }}</span><strong>{{ s.patientShare | currency: 'GEL' : 'symbol-narrow' : '1.0-0' }}</strong></div>
          <div class="stat"><span>{{ 'Collected' | t }}</span><strong>{{ s.collected | currency: 'GEL' : 'symbol-narrow' : '1.0-0' }}</strong></div>
          <div class="stat"><span>{{ 'Refunded' | t }}</span><strong>{{ s.refunded | currency: 'GEL' : 'symbol-narrow' : '1.0-0' }}</strong></div>
          <div class="stat"><span>{{ 'Outstanding balance' | t }}</span><strong>{{ s.outstandingBalance | currency: 'GEL' : 'symbol-narrow' : '1.0-0' }}</strong></div>
        </div>

        @if (revenue(); as rev) {
          <div class="page-head section-gap">
            <h2>{{ 'Revenue by {p0}' | t: { p0: (rev.groupBy) } }}</h2>
            <div class="tabs compact" role="tablist" [attr.aria-label]="'Measure' | t">
              <button type="button" role="tab" [class.active]="measure() === 'collected'" [attr.aria-selected]="measure() === 'collected'" (click)="measure.set('collected')">{{ 'Collected' | t }}</button>
              <button type="button" role="tab" [class.active]="measure() === 'billed'" [attr.aria-selected]="measure() === 'billed'" (click)="measure.set('billed')">{{ 'Billed' | t }}</button>
            </div>
          </div>

          @if (rev.rows.length === 0) {
            <p class="empty card muted">{{ 'No invoices or payments in this period.' | t }}</p>
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
                          <span>{{ (measure() === 'collected' ? 'Collected' : 'Billed') | t }}: {{ value(r) | currency: 'GEL' : 'symbol-narrow' }}</span>
                          <span class="muted">{{ '{p0} invoice(s)' | t: { p0: (r.invoices) } }}</span>
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
              <summary>{{ 'Show as table' | t }}</summary>
              <div class="table-wrap">
                <table class="table">
                  <thead><tr><th>{{ 'Period' | t }}</th><th class="right">{{ 'Invoices' | t }}</th><th class="right">{{ 'Billed' | t }}</th><th class="right">{{ 'Insurance' | t }}</th><th class="right">{{ 'Patient' | t }}</th><th class="right">{{ 'Collected' | t }}</th></tr></thead>
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
                      <td>{{ 'Total' | t }}</td>
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
            <h2>{{ 'Payments by method' | t }}</h2>
            <div class="table-wrap">
              <table class="table">
                <thead><tr><th>{{ 'Method' | t }}</th><th class="right">{{ 'Payments' | t }}</th><th class="right">{{ 'Amount' | t }}</th></tr></thead>
                <tbody>
                  @for (m of rev.byMethod; track m.method) {
                    <tr><td>{{ words(m.method) | t }}</td><td class="right">{{ m.payments }}</td><td class="right">{{ m.amount | currency: 'GEL' : 'symbol-narrow' }}</td></tr>
                  }
                </tbody>
              </table>
            </div>
          }
        }

        <h2>{{ 'Visits by doctor' | t }}</h2>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>{{ 'Doctor' | t }}</th><th class="right">{{ 'Total' | t }}</th><th class="right">{{ 'Completed' | t }}</th><th class="right">{{ 'Scheduled' | t }}</th><th class="right">{{ 'Cancelled' | t }}</th><th class="right">{{ 'Missed' | t }}</th><th class="right">{{ 'Billed' | t }}</th></tr></thead>
            <tbody>
              @for (d of doctors(); track d.doctorId) {
                <tr>
                  <td><a [routerLink]="['/doctors', d.doctorId]">{{ 'Dr. {p0}' | t: { p0: (d.doctorName) } }}</a> <span class="muted small">{{ d.specialization | t }}</span></td>
                  <td class="right">{{ d.total }}</td>
                  <td class="right">{{ d.completed }}</td>
                  <td class="right">{{ d.scheduled }}</td>
                  <td class="right">{{ d.cancelled }}</td>
                  <td class="right">{{ d.noShow }}</td>
                  <td class="right">{{ d.billed | currency: 'GEL' : 'symbol-narrow' }}</td>
                </tr>
              } @empty {
                <tr><td colspan="7" class="muted">{{ 'No data.' | t }}</td></tr>
              }
            </tbody>
          </table>
        </div>

        <h2>{{ 'Most popular services' | t }}</h2>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>{{ 'Service' | t }}</th><th>{{ 'Department' | t }}</th><th class="right">{{ 'Visits' | t }}</th><th class="right">{{ 'Billed' | t }}</th></tr></thead>
            <tbody>
              @for (sv of services(); track sv.serviceId) {
                <tr>
                  <td>{{ sv.serviceName }}</td>
                  <td>{{ sv.department | t }}</td>
                  <td class="right">{{ sv.appointments }}</td>
                  <td class="right">{{ sv.billed | currency: 'GEL' : 'symbol-narrow' }}</td>
                </tr>
              } @empty {
                <tr><td colspan="4" class="muted">{{ 'No data.' | t }}</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }
  `
})
export class ReportsPage {
  protected readonly i18n = inject(I18n);
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

  protected readonly today = toDateInput(new Date());
  protected readonly preset = signal<PresetId | 'custom'>('30');
  protected readonly presets: { id: PresetId; label: string }[] = [
    { id: 'today', label: 'Today' }, { id: '7', label: 'Last 7 days' }, { id: '30', label: 'Last 30 days' },
    { id: 'thisMonth', label: 'This month' }, { id: 'lastMonth', label: 'Last month' }, { id: '90', label: 'Last 90 days' },
    { id: 'thisYear', label: 'This year' }, { id: '365', label: 'Last 12 months' }
  ];

  /** Days in the chosen period, both ends included. */
  protected dayCount(): number {
    if (!this.from || !this.to) return 0;
    return Math.round((new Date(this.to + 'T00:00:00').getTime() - new Date(this.from + 'T00:00:00').getTime()) / 86_400_000) + 1;
  }

  protected applyPreset(id: PresetId): void {
    const now = new Date();
    const first = (y: number, m: number) => new Date(y, m, 1);
    let from: Date, to: Date = now;
    switch (id) {
      case 'today': from = now; break;
      case 'thisMonth': from = first(now.getFullYear(), now.getMonth()); break;
      case 'lastMonth': from = first(now.getFullYear(), now.getMonth() - 1); to = addDays(first(now.getFullYear(), now.getMonth()), -1); break;
      case 'thisYear': from = first(now.getFullYear(), 0); break;
      default: from = addDays(now, -(Number(id) - 1));
    }
    this.from = toDateInput(from);
    this.to = toDateInput(to);
    this.groupBy = this.dayCount() > 92 ? 'month' : 'day';
    this.preset.set(id);
    this.load();
  }

  /** The person picked dates in the calendar. */
  protected custom(): void {
    this.preset.set('custom');
    if (this.from && this.to && this.from <= this.to) this.load();
  }

  protected setGroup(group: 'day' | 'month'): void {
    this.groupBy = group;
    this.load();
  }

  protected load(): void {
    if (!this.from || !this.to || this.from > this.to) {
      this.error.set(this.i18n.t('"From" must be on or before "To".'));
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
