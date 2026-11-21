import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { BillingApi } from '../../core/billing.api';
import { AuthService } from '../../core/auth.service';
import { Invoice, Payment, PaymentMethod, Receipt } from '../../core/model';
import { apiErrorMessage } from '../../core/api-error';
import { LocalDatePipe, TranslatePipe } from '../../core/i18n';
import { orNull, splitWords } from '../../core/util';

type Panel = 'pay' | 'cancel' | { refund: number } | null;

@Component({
  selector: 'app-invoice-detail',
  imports: [LocalDatePipe, TranslatePipe, FormsModule, RouterLink, CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="back" routerLink="/invoices">{{ '← Invoices' | t }}</a>

    @if (message()) { <p class="alert success" role="status">{{ message() }}</p> }
    @if (error()) { <p class="alert error" role="alert">{{ error() }}</p> }

    @if (invoice(); as inv) {
      <div class="page-head">
        <div>
          <h1>{{ 'Invoice {p0}' | t: { p0: (inv.invoiceNumber) } }}</h1>
          <p class="muted">
            {{ 'Issued' | t }} {{ inv.issueDate | ldate: 'long' }}
            @if (inv.dueDate) { {{ '· due' | t }} {{ inv.dueDate | ldate: 'long' }} }
            @if (isStaff()) { · <a [routerLink]="['/patients', inv.patientId]">{{ inv.patientName }}</a> } @else { · {{ inv.patientName }} }
          </p>
        </div>
        <span [class]="'badge big-badge inv-' + inv.status.toLowerCase()">{{ words(inv.status) | t }}</span>
      </div>

      <div class="stat-grid">
        <div class="stat"><span>{{ 'Subtotal' | t }}</span><strong>{{ inv.subtotal | currency: 'GEL' : 'symbol-narrow' }}</strong></div>
        <div class="stat"><span>{{ 'Insurance pays' | t }}</span><strong>{{ inv.insuranceCoverage | currency: 'GEL' : 'symbol-narrow' }}</strong></div>
        <div class="stat"><span>{{ 'Patient pays' | t }}</span><strong>{{ inv.totalAmount | currency: 'GEL' : 'symbol-narrow' }}</strong></div>
        <div class="stat"><span>{{ 'Paid' | t }}</span><strong>{{ inv.paidAmount | currency: 'GEL' : 'symbol-narrow' }}</strong></div>
        <div class="stat accent"><span>{{ 'Balance' | t }}</span><strong>{{ inv.balance | currency: 'GEL' : 'symbol-narrow' }}</strong></div>
      </div>

      @if (inv.insuranceCompany) {
        <p class="muted">{{ 'Insurance: {p0} · policy {p1} · {p2}% coverage' | t: { p0: (inv.insuranceCompany), p1: (inv.policyNumber), p2: (inv.coveragePercent) } }}</p>
      }

      <h2>{{ 'Items' | t }}</h2>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>{{ 'Description' | t }}</th><th class="right">{{ 'Qty' | t }}</th><th class="right">{{ 'Unit price' | t }}</th><th class="right">{{ 'Total' | t }}</th></tr></thead>
          <tbody>
            @for (item of inv.items; track item.id) {
              <tr>
                <td>{{ item.description }}</td>
                <td class="right">{{ item.quantity }}</td>
                <td class="right">{{ item.unitPrice | currency: 'GEL' : 'symbol-narrow' }}</td>
                <td class="right">{{ item.lineTotal | currency: 'GEL' : 'symbol-narrow' }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <div class="page-head section-gap">
        <h2>{{ 'Payments' | t }}</h2>
        @if (isStaff() && inv.status !== 'Cancelled') {
          <div class="card-actions tight">
            @if (inv.balance > 0) {
              <button class="btn primary small" type="button" (click)="openPay(inv)">{{ 'Record a payment' | t }}</button>
            }
            @if (inv.paidAmount === 0) {
              <button class="btn small danger" type="button" (click)="open('cancel')">{{ 'Cancel invoice' | t }}</button>
            }
          </div>
        }
      </div>

      @if (panel() === 'pay') {
        <form class="inline-panel" (ngSubmit)="pay(inv)">
          <div class="form-grid three">
            <div class="field">
              <label for="pay-amount">{{ 'Amount (GEL)' | t }}</label>
              <input id="pay-amount" name="amount" type="number" min="0.01" step="0.01" [max]="inv.balance" [(ngModel)]="amount" />
            </div>
            <div class="field">
              <label for="pay-method">{{ 'Method' | t }}</label>
              <select id="pay-method" name="method" [(ngModel)]="method">
                <option value="Cash">{{ 'Cash' | t }}</option>
                <option value="Card">{{ 'Card' | t }}</option>
                <option value="BankTransfer">{{ 'Bank transfer' | t }}</option>
              </select>
            </div>
            <div class="field">
              <label for="pay-ref">{{ 'Reference (optional)' | t }}</label>
              <input id="pay-ref" name="reference" maxlength="100" [(ngModel)]="reference" />
            </div>
          </div>
          <div class="card-actions">
            <button class="btn primary small" type="submit" [disabled]="busy()">{{ 'Save payment' | t }}</button>
            <button class="btn small" type="button" (click)="panel.set(null)">{{ 'Cancel' | t }}</button>
          </div>
        </form>
      }

      @if (panel() === 'cancel') {
        <form class="inline-panel" (ngSubmit)="cancel(inv)">
          <div class="field">
            <label for="cancel-reason">{{ 'Why is this invoice being cancelled?' | t }}</label>
            <textarea id="cancel-reason" name="reason" rows="2" minlength="3" maxlength="500" [(ngModel)]="reason"></textarea>
          </div>
          <div class="card-actions">
            <button class="btn small danger" type="submit" [disabled]="busy() || reason.trim().length < 3">{{ 'Cancel invoice' | t }}</button>
            <button class="btn small" type="button" (click)="panel.set(null)">{{ 'Keep it' | t }}</button>
          </div>
        </form>
      }

      @if (inv.payments.length === 0) {
        <p class="muted">{{ 'No payments yet.' | t }}</p>
      } @else {
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>{{ 'Date' | t }}</th><th>{{ 'Method' | t }}</th><th>{{ 'Reference' | t }}</th><th class="right">{{ 'Amount' | t }}</th><th>{{ 'Status' | t }}</th><th></th></tr></thead>
            <tbody>
              @for (p of inv.payments; track p.id) {
                <tr>
                  <td>{{ (p.paidAt ?? p.createdAt) | ldate: 'mediumTime' }}</td>
                  <td>{{ words(p.method) | t }}</td>
                  <td>{{ p.transactionReference ?? '—' }}</td>
                  <td class="right">{{ p.amount | currency: 'GEL' : 'symbol-narrow' }}</td>
                  <td><span [class]="'badge pay-' + p.status.toLowerCase()">{{ p.status | t }}</span></td>
                  <td class="right nowrap">
                    @if (p.status === 'Completed') {
                      <button class="btn small" type="button" (click)="showReceipt(p)">{{ 'Receipt' | t }}</button>
                      @if (isAdmin()) {
                        <button class="btn small danger" type="button" (click)="openRefund(p)">{{ 'Refund' | t }}</button>
                      }
                    }
                  </td>
                </tr>
                @if (refundingId() === p.id) {
                  <tr>
                    <td colspan="6">
                      <form class="inline-panel" (ngSubmit)="refund(p)">
                        <div class="field">
                          <label [for]="'refund-' + p.id">{{ 'Reason for the refund' | t }}</label>
                          <input [id]="'refund-' + p.id" name="refundReason" minlength="3" maxlength="500" [(ngModel)]="reason" />
                        </div>
                        <div class="card-actions">
                          <button class="btn small danger" type="submit" [disabled]="busy() || reason.trim().length < 3">{{ 'Refund' | t }} {{ p.amount | currency: 'GEL' : 'symbol-narrow' }}</button>
                          <button class="btn small" type="button" (click)="panel.set(null)">{{ 'Back' | t }}</button>
                        </div>
                      </form>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      }

      @if (receipt(); as r) {
        <section class="card receipt section-gap" [attr.aria-label]="'Receipt' | t">
          <div class="row-head">
            <h3>{{ r.clinicName }}</h3>
            <button class="btn small" type="button" (click)="receipt.set(null)">{{ 'Close' | t }}</button>
          </div>
          <dl class="details">
            <dt>{{ 'Receipt' | t }}</dt><dd>{{ r.receiptNumber }}</dd>
            <dt>{{ 'Invoice' | t }}</dt><dd>{{ r.invoiceNumber }}</dd>
            <dt>{{ 'Patient' | t }}</dt><dd>{{ r.patientName }}</dd>
            <dt>{{ 'Paid' | t }}</dt><dd>{{ r.paidAt | ldate: 'longTime' }}</dd>
            <dt>{{ 'Method' | t }}</dt><dd>{{ words(r.method) | t }}@if (r.transactionReference) { · {{ r.transactionReference }} }</dd>
            <dt>{{ 'Amount' | t }}</dt><dd><strong>{{ r.amount | currency: 'GEL' : 'symbol-narrow' }}</strong></dd>
          </dl>
          <button class="btn small" type="button" (click)="print()">{{ 'Print' | t }}</button>
        </section>
      }
    } @else if (!error()) {
      <p class="muted">{{ 'Loading...' | t }}</p>
    }
  `
})
export class InvoiceDetailPage {
  private readonly api = inject(BillingApi);
  private readonly auth = inject(AuthService);
  private readonly id = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));

  protected readonly words = splitWords;
  protected readonly invoice = signal<Invoice | null>(null);
  protected readonly receipt = signal<Receipt | null>(null);
  protected readonly panel = signal<Panel>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly message = signal<string | null>(null);
  protected readonly isStaff = computed(() => this.auth.hasRole('Admin', 'Receptionist'));
  protected readonly isAdmin = computed(() => this.auth.hasRole('Admin'));
  protected readonly refundingId = computed(() => {
    const p = this.panel();
    return p && typeof p === 'object' ? p.refund : null;
  });

  protected amount = 0;
  protected method: PaymentMethod = 'Cash';
  protected reference = '';
  protected reason = '';

  constructor() {
    this.load();
  }

  protected open(panel: Panel): void {
    this.panel.set(panel);
    this.reason = '';
    this.error.set(null);
    this.message.set(null);
  }

  protected openPay(inv: Invoice): void {
    this.amount = inv.balance;
    this.method = 'Cash';
    this.reference = '';
    this.open('pay');
  }

  protected openRefund(p: Payment): void {
    this.open({ refund: p.id });
  }

  protected pay(inv: Invoice): void {
    const amount = Number(this.amount);
    if (!(amount > 0) || amount > inv.balance) {
      this.error.set(`Enter an amount between 0.01 and ${inv.balance}.`);
      return;
    }
    this.run(this.api.addPayment(inv.id, amount, this.method, orNull(this.reference)), 'The payment was recorded.');
  }

  protected cancel(inv: Invoice): void {
    this.run(this.api.cancelInvoice(inv.id, this.reason.trim()), 'The invoice was cancelled.');
  }

  protected refund(p: Payment): void {
    this.run(this.api.refund(p.id, this.reason.trim()), 'The payment was refunded.');
  }

  protected showReceipt(p: Payment): void {
    this.api.receipt(p.id).subscribe({
      next: r => this.receipt.set(r),
      error: err => this.error.set(apiErrorMessage(err))
    });
  }

  protected print(): void {
    window.print();
  }

  private run(request: Observable<unknown>, success: string): void {
    this.busy.set(true);
    this.error.set(null);
    request.subscribe({
      next: () => {
        this.busy.set(false);
        this.panel.set(null);
        this.message.set(success);
        this.load();
      },
      error: err => {
        this.busy.set(false);
        this.error.set(apiErrorMessage(err));
      }
    });
  }

  private load(): void {
    this.api.invoice(this.id).subscribe({
      next: inv => this.invoice.set(inv),
      error: err => this.error.set(apiErrorMessage(err))
    });
  }
}
