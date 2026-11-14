import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BillingApi } from '../core/billing.api';
import { InvoiceListItem, InvoiceStatus, PagedResult } from '../core/model';
import { apiErrorMessage } from '../core/api-error';
import { splitWords } from '../core/util';
import { Pager } from './pager';

const STATUSES: InvoiceStatus[] = ['Issued', 'PartiallyPaid', 'Paid', 'Cancelled', 'Draft'];

@Component({
  selector: 'app-invoice-list',
  imports: [FormsModule, RouterLink, DatePipe, CurrencyPipe, Pager],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (filters()) {
      <form class="filters" (ngSubmit)="page.set(1); load()">
        <div class="field">
          <label for="inv-search">Search</label>
          <input id="inv-search" name="search" type="search" placeholder="Invoice number or patient" [(ngModel)]="search" />
        </div>
        <div class="field">
          <label for="inv-status">Status</label>
          <select id="inv-status" name="status" [(ngModel)]="status" (ngModelChange)="page.set(1); load()">
            <option [ngValue]="null">All</option>
            @for (s of statuses; track s) { <option [ngValue]="s">{{ words(s) }}</option> }
          </select>
        </div>
        <div class="field"><label for="inv-from">From</label><input id="inv-from" name="from" type="date" [(ngModel)]="from" (change)="page.set(1); load()" /></div>
        <div class="field"><label for="inv-to">To</label><input id="inv-to" name="to" type="date" [(ngModel)]="to" (change)="page.set(1); load()" /></div>
      </form>
    }

    @if (error()) { <p class="alert error" role="alert">{{ error() }}</p> }
    @if (loading() && !result()) { <p class="muted">Loading...</p> }

    @if (result(); as data) {
      @if (data.items.length === 0) {
        <p class="empty card muted">No invoices.</p>
      } @else {
        <div class="table-wrap" [class.dim]="loading()">
          <table class="table">
            <thead>
              <tr>
                <th>Invoice</th><th>Issued</th>@if (showPatient()) { <th>Patient</th> }
                <th class="right">Total</th><th class="right">Insurance</th><th class="right">Balance</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              @for (i of data.items; track i.id) {
                <tr>
                  <td><a [routerLink]="['/invoices', i.id]">{{ i.invoiceNumber }}</a></td>
                  <td>{{ i.issueDate | date: 'd MMM y' }}</td>
                  @if (showPatient()) { <td>{{ i.patientName }}</td> }
                  <td class="right">{{ i.totalAmount | currency: 'GEL' : 'symbol-narrow' }}</td>
                  <td class="right">{{ i.insuranceCoverage | currency: 'GEL' : 'symbol-narrow' }}</td>
                  <td class="right"><strong>{{ i.balance | currency: 'GEL' : 'symbol-narrow' }}</strong></td>
                  <td><span [class]="'badge inv-' + i.status.toLowerCase()">{{ words(i.status) }}</span></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
      <app-pager [page]="page()" [pageSize]="pageSize" [totalCount]="data.totalCount" [disabled]="loading()" (pageChange)="page.set($event); load()" />
    }
  `
})
export class InvoiceList {
  private readonly api = inject(BillingApi);

  readonly patientId = input<number | null>(null);
  readonly filters = input(false);
  readonly showPatient = input(false);

  protected readonly statuses = STATUSES;
  protected readonly words = splitWords;
  protected readonly pageSize = 15;
  protected readonly page = signal(1);
  protected readonly result = signal<PagedResult<InvoiceListItem> | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected search = '';
  protected status: InvoiceStatus | null = null;
  protected from = '';
  protected to = '';

  constructor() {
    effect(() => {
      this.patientId();
      untracked(() => this.load());
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.api.invoices({
      patientId: this.patientId(),
      search: this.search.trim() || null,
      status: this.status,
      from: this.from || null,
      to: this.to || null,
      page: this.page(),
      pageSize: this.pageSize
    }).subscribe({
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
