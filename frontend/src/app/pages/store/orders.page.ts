import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { StoreApi } from '../../core/store.api';
import { AuthService } from '../../core/auth.service';
import { PagedResult, StoreOrder, StoreOrderStatus } from '../../core/model';
import { apiErrorMessage } from '../../core/api-error';
import { saveDownload, splitWords } from '../../core/util';
import { Pager } from '../../shared/pager';
import { I18n, LocalDatePipe, TranslatePipe } from '../../core/i18n';

const STATUS_LABEL: Record<StoreOrderStatus, string> = {
  AwaitingReview: 'Checking prescription',
  ReadyForPickup: 'Ready for pickup',
  OutForDelivery: 'On its way',
  Completed: 'Collected',
  Rejected: 'Rejected · refunded',
  Cancelled: 'Cancelled · refunded'
};

/** Steps of a home delivery, shown as a progress tracker. */
const DELIVERY_STEPS = ['Paid', 'Preparing', 'On its way', 'Delivered'];

/** Patients: "My orders". Reception and admins: every order, with prescription checks and handover. */
@Component({
  selector: 'app-orders',
  imports: [FormsModule, RouterLink, CurrencyPipe, Pager, TranslatePipe, LocalDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head">
      <h1>{{ (isStaff() ? 'Pharmacy orders' : 'My orders') | t }}</h1>
      @if (!isStaff()) { <a class="btn primary" routerLink="/pharmacy">{{ 'Go to the pharmacy' | t }}</a> }
    </div>

    <div class="tabs scroll" role="tablist">
      @for (f of filters; track f.label) {
        <button type="button" role="tab" [class.active]="status() === f.value" [attr.aria-selected]="status() === f.value"
          (click)="status.set(f.value); page.set(1); load()">{{ f.label | t }}</button>
      }
    </div>

    @if (isStaff()) {
      <form class="toolbar" (ngSubmit)="page.set(1); load()">
        <div class="field grow"><label for="o-search" class="sr-only">{{ 'Search' | t }}</label>
          <input id="o-search" name="search" type="search" [placeholder]="'Order number, patient name or personal number' | t" [(ngModel)]="search" />
        </div>
        <button class="btn small" type="submit">{{ 'Search' | t }}</button>
      </form>
    }

    @if (message()) { <p class="alert success" role="status">{{ message() }}</p> }
    @if (error()) { <p class="alert error" role="alert">{{ error() }}</p> }
    @if (loading() && !result()) { <p class="muted">{{ 'Loading...' | t }}</p> }

    @if (result(); as data) {
      @if (data.items.length === 0) {
        <p class="empty card muted">{{ 'No orders here.' | t }}</p>
      }
      <ul class="stack" [class.dim]="loading()">
        @for (o of data.items; track o.id) {
          <li class="card order-card">
            <div class="row-head">
              <div>
                <h3>{{ o.orderNumber }} · {{ o.total | currency: 'GEL' : 'symbol-narrow' }}</h3>
                <p class="muted">
                  {{ o.createdAt | ldate: 'mediumTime' }}
                  @if (isStaff()) {
                    @if (o.patientId) { · <a [routerLink]="['/patients', o.patientId]">{{ o.patientName }}</a> ({{ o.patientPersonalNumber }}) }
                    @else { · {{ o.patientName }} <span class="badge">{{ 'No account' | t }}</span> }
                    @if (o.customerEmail || o.customerPhone) { <br /><span class="small">✉ {{ o.customerEmail }} · ☎ {{ o.customerPhone }}</span> }
                  }
                </p>
              </div>
              <span class="order-badges">
                @if (o.fulfilment === 'Delivery') { <span class="badge ord-delivery">🚚 {{ 'Delivery' | t }}</span> }
                <span [class]="'badge ord-' + o.status.toLowerCase()">{{ label(o) | t }}</span>
              </span>
            </div>

            @if (o.fulfilment === 'Delivery' && o.status !== 'Cancelled' && o.status !== 'Rejected') {
              <ol class="track" [attr.aria-label]="'Delivery progress' | t">
                @for (s of deliverySteps; track s; let i = $index) {
                  <li [class.done]="i < step(o)" [class.now]="i === step(o)" [attr.aria-current]="i === step(o) ? 'step' : null">
                    <span class="track-dot" aria-hidden="true">{{ i < step(o) ? '✓' : i + 1 }}</span>
                    <span class="track-label">{{ s | t }}</span>
                  </li>
                }
              </ol>
            }

            <ul class="order-items">
              @for (i of o.items; track i.productId) {
                <li>
                  {{ i.quantity }} × {{ i.productName }}
                  @if (i.requiresPrescription) {
                    <span class="rx-mini">℞</span>
                    <span class="muted small">{{ i.prescriptionCode ? ('code {code}' | t: { code: i.prescriptionCode }) : ('uploaded prescription' | t) }}</span>
                  }
                  <span class="muted"> · {{ i.lineTotal | currency: 'GEL' : 'symbol-narrow' }}</span>
                </li>
              }
            </ul>

            @if (o.prescriptionFileName) {
              <p class="small">
                📄 {{ 'Prescription file' | t }}: {{ o.prescriptionFileName }}
                <button type="button" class="link-like" (click)="download(o)">{{ 'Open' | t }}</button>
              </p>
            }
            @if (o.reviewNote) { <p class="small"><span class="muted">{{ (o.status === 'Rejected' ? 'Reason' : 'Note') | t }}:</span> {{ o.reviewNote }}</p> }
            @if (o.fulfilment === 'Delivery') {
              <div class="delivery-box small">
                <p><strong>🚚 {{ o.deliveryAddress }}, {{ o.deliveryCity | t }}</strong></p>
                <p class="muted">☎ {{ o.deliveryPhone }}@if (o.deliveryNotes) { · {{ o.deliveryNotes }} }</p>
                <p class="muted">{{ 'Delivery' | t }}: @if (o.deliveryFee > 0) { {{ o.deliveryFee | currency: 'GEL' : 'symbol-narrow' }} } @else { {{ 'Free' | t }} }
                  @if (o.dispatchedAt) { · {{ 'sent out {time}' | t: { time: (o.dispatchedAt + 'Z' | ldate: 'dayMonthTime') } }} }
                  @if (o.completedAt && o.status === 'Completed') { · {{ 'delivered {time}' | t: { time: (o.completedAt + 'Z' | ldate: 'dayMonthTime') } }} }
                </p>
              </div>
            }
            @if (o.status === 'ReadyForPickup' && o.fulfilment === 'Pickup' && !isStaff()) {
              <p class="small">📍 {{ 'Collect your order at the clinic pharmacy desk. Bring a photo ID.' | t }}</p>
            }
            @if (o.status === 'OutForDelivery' && !isStaff()) {
              <p class="small">🚚 {{ 'Your order is on its way. The courier will call you before arriving.' | t }}</p>
            }

            @if (openId() !== o.id) {
              <div class="card-actions">
                @if (isStaff() && o.status === 'AwaitingReview') {
                  <button class="btn small primary" type="button" (click)="open(o.id, 'approve')">{{ 'Accept prescription' | t }}</button>
                  <button class="btn small danger" type="button" (click)="open(o.id, 'reject')">{{ 'Reject…' | t }}</button>
                }
                @if (isStaff() && o.status === 'ReadyForPickup' && o.fulfilment === 'Pickup') {
                  <button class="btn small primary" type="button" (click)="run(api.completeOrder(o.id), 'The order was handed over.')" [disabled]="busy()">{{ 'Handed over' | t }}</button>
                }
                @if (isStaff() && o.status === 'ReadyForPickup' && o.fulfilment === 'Delivery') {
                  <button class="btn small primary" type="button" (click)="run(api.dispatchOrder(o.id), 'The order was sent out for delivery. The patient was told it is on its way.')" [disabled]="busy()">🚚 {{ 'Send out for delivery' | t }}</button>
                }
                @if (isStaff() && o.status === 'OutForDelivery') {
                  <button class="btn small primary" type="button" (click)="run(api.completeOrder(o.id), 'The order was marked as delivered.')" [disabled]="busy()">✓ {{ 'Mark delivered' | t }}</button>
                }
                @if (o.status === 'AwaitingReview' || o.status === 'ReadyForPickup') {
                  <button class="btn small" type="button" (click)="open(o.id, 'cancel')">{{ 'Cancel order' | t }}</button>
                }
              </div>
            } @else {
              <div class="inline-panel">
                @switch (mode()) {
                  @case ('approve') {
                    <p>{{ 'Check that the prescription is genuine, in the patient\\'s name, signed and still valid, and covers the medicines ordered.' | t }}</p>
                    <div class="field"><label [for]="'note-' + o.id">{{ 'Note (optional)' | t }}</label><input [id]="'note-' + o.id" maxlength="500" [(ngModel)]="text" /></div>
                    <div class="card-actions">
                      <button class="btn small primary" type="button" (click)="run(api.approveOrder(o.id, text.trim() || null), 'The prescription was accepted. The patient was told the order is ready.')" [disabled]="busy()">{{ 'Accept' | t }}</button>
                      <button class="btn small" type="button" (click)="openId.set(null)">{{ 'Back' | t }}</button>
                    </div>
                  }
                  @case ('reject') {
                    <div class="field"><label [for]="'reason-' + o.id">{{ 'Why can\\'t it be accepted? (sent to the patient)' | t }}</label>
                      <input [id]="'reason-' + o.id" maxlength="500" [placeholder]="'For example: the prescription has expired.' | t" [(ngModel)]="text" /></div>
                    <div class="card-actions">
                      <button class="btn small danger" type="button" (click)="run(api.rejectOrder(o.id, text.trim()), 'The order was rejected and refunded.')" [disabled]="busy() || text.trim().length < 5">{{ 'Reject and refund' | t }}</button>
                      <button class="btn small" type="button" (click)="openId.set(null)">{{ 'Back' | t }}</button>
                    </div>
                  }
                  @case ('cancel') {
                    <p>{{ 'Cancel order {number}? {total} will be refunded to your card.' | t: { number: o.orderNumber, total: (o.total | currency: 'GEL' : 'symbol-narrow') } }}</p>
                    <div class="card-actions">
                      <button class="btn small danger" type="button" (click)="run(api.cancelOrder(o.id), 'The order was cancelled and refunded.')" [disabled]="busy()">{{ 'Cancel order' | t }}</button>
                      <button class="btn small" type="button" (click)="openId.set(null)">{{ 'Keep it' | t }}</button>
                    </div>
                  }
                }
              </div>
            }
          </li>
        }
      </ul>
      <app-pager [page]="page()" [pageSize]="pageSize" [totalCount]="data.totalCount" [disabled]="loading()" (pageChange)="page.set($event); load()" />
    }
  `
})
export class OrdersPage {
  protected readonly api = inject(StoreApi);
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18n);

  protected readonly isStaff = computed(() => this.auth.hasRole('Admin', 'Receptionist'));
  protected readonly filters: { label: string; value: StoreOrderStatus | null }[] = [
    { label: 'All', value: null },
    { label: 'Checking prescription', value: 'AwaitingReview' },
    { label: 'Ready', value: 'ReadyForPickup' },
    { label: 'Out for delivery', value: 'OutForDelivery' },
    { label: 'Completed', value: 'Completed' },
    { label: 'Rejected', value: 'Rejected' },
    { label: 'Cancelled', value: 'Cancelled' }
  ];

  protected readonly pageSize = 15;
  protected readonly page = signal(1);
  protected readonly status = signal<StoreOrderStatus | null>(this.isStaff() ? 'AwaitingReview' : null);
  protected readonly result = signal<PagedResult<StoreOrder> | null>(null);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly message = signal<string | null>(null);
  protected readonly openId = signal<number | null>(null);
  protected readonly mode = signal<'approve' | 'reject' | 'cancel'>('approve');
  protected search = '';
  protected text = '';

  constructor() {
    this.load();
  }

  protected readonly deliverySteps = DELIVERY_STEPS;

  /** Status text; delivery orders read "Preparing" and "Delivered" instead of pickup wording. */
  protected label(o: StoreOrder): string {
    if (o.fulfilment === 'Delivery') {
      if (o.status === 'ReadyForPickup') return 'Preparing for delivery';
      if (o.status === 'Completed') return 'Delivered';
    }
    return STATUS_LABEL[o.status] ?? splitWords(o.status);
  }

  /** Index of the current step in the delivery tracker. */
  protected step(o: StoreOrder): number {
    switch (o.status) {
      case 'AwaitingReview': return 0;
      case 'ReadyForPickup': return 1;
      case 'OutForDelivery': return 2;
      case 'Completed': return 4;
      default: return 0;
    }
  }

  protected open(id: number, mode: 'approve' | 'reject' | 'cancel'): void {
    this.openId.set(id);
    this.mode.set(mode);
    this.text = '';
    this.error.set(null);
    this.message.set(null);
  }

  protected download(o: StoreOrder): void {
    this.api.orderPrescriptionFile(o.id).subscribe({
      next: r => saveDownload(r, o.prescriptionFileName ?? 'prescription'),
      error: err => this.error.set(apiErrorMessage(err))
    });
  }

  protected run(request: Observable<unknown>, success: string): void {
    this.busy.set(true);
    this.error.set(null);
    request.subscribe({
      next: () => {
        this.busy.set(false);
        this.openId.set(null);
        this.message.set(this.i18n.t(success));
        this.load();
      },
      error: err => {
        this.busy.set(false);
        this.error.set(apiErrorMessage(err));
      }
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.api.orders({ status: this.status(), search: this.search.trim() || null, page: this.page(), pageSize: this.pageSize }).subscribe({
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
