import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { ClinicService } from '../../core/model';
import { apiErrorMessage } from '../../core/api-error';
import { TranslatePipe } from '../../core/i18n';

/** Public price list: every service by department, with the doctors who offer it. */
@Component({
  selector: 'app-services',
  imports: [TranslatePipe, FormsModule, RouterLink, CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head">
      <div>
        <p class="eyebrow">{{ 'Transparent pricing' | t }}</p>
        <h1>{{ 'Services and prices' | t }}</h1>
        <p class="muted">{{ 'What we offer and what it costs. If you have insurance on file, your insurer\\'s share is taken off when you pay.' | t }}</p>
      </div>
    </div>

    <div class="toolbar">
      <div class="field grow"><label for="sv-q" class="sr-only">{{ 'Search services' | t }}</label>
        <input id="sv-q" type="search" [placeholder]="'Search services, e.g. ultrasound' | t" [ngModel]="search()" (ngModelChange)="search.set($event)" /></div>
      <span class="muted small">{{ (count() === 1 ? '1 service' : '{n} services') | t: { n: count() } }}</span>
    </div>

    @if (error()) { <p class="alert error" role="alert">{{ error() }}</p> }
    @if (loading()) { <p class="muted">{{ 'Loading...' | t }}</p> }
    @if (!loading() && groups().length === 0) { <p class="empty card muted">{{ 'No services match your search.' | t }}</p> }

    <div class="dept-list">
      @for (g of groups(); track g.department) {
        <section class="card dept-card">
          <h2 class="no-rule">{{ g.department | t }}</h2>
          <ul class="service-rows">
            @for (s of g.services; track s.id) {
              <li>
                <div class="service-main">
                  <strong>{{ s.name }}</strong>
                  <span class="muted small">{{ '{n} min' | t: { n: s.durationMinutes } }}</span>
                  @if (s.description) { <span class="small">{{ s.description }}</span> }
                  @if (s.doctors.length > 0) {
                    <span class="small service-doctors">
                      {{ 'With' | t }}
                      @for (d of s.doctors; track d.id; let last = $last) {
                        <a [routerLink]="['/doctors', d.id]">Dr. {{ d.name }}</a>@if (!last) {, }
                      }
                    </span>
                  } @else {
                    <span class="muted small">{{ 'Not available online at the moment.' | t }}</span>
                  }
                </div>
                <div class="service-side">
                  <span class="price-tag">{{ s.price | currency: 'GEL' : 'symbol-narrow' : '1.0-2' }}</span>
                  @if (s.doctors.length === 1) {
                    <a class="btn small primary" [routerLink]="['/book', s.doctors[0].id]" [queryParams]="{ serviceId: s.id }">{{ 'Book' | t }}</a>
                  }
                </div>
              </li>
            }
          </ul>
        </section>
      }
    </div>
  `
})
export class ServicesPage {
  private readonly http = inject(HttpClient);

  protected readonly services = signal<ClinicService[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly search = signal('');

  private readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.services().filter(s => !q
      || s.name.toLowerCase().includes(q)
      || s.department.toLowerCase().includes(q)
      || s.doctors.some(d => d.name.toLowerCase().includes(q)));
  });

  protected readonly count = computed(() => this.filtered().length);

  protected readonly groups = computed(() => {
    const byDept = new Map<string, ClinicService[]>();
    for (const s of this.filtered()) byDept.set(s.department, [...(byDept.get(s.department) ?? []), s]);
    return [...byDept.entries()].map(([department, services]) => ({ department, services }));
  });

  constructor() {
    this.http.get<ClinicService[]>('/api/services').subscribe({
      next: list => {
        this.services.set(list);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(apiErrorMessage(err));
        this.loading.set(false);
      }
    });
  }
}
