import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, switchMap, of } from 'rxjs';
import { StoreApi } from '../../core/store.api';
import { CartLine, CartService } from '../../core/cart.service';
import { MedicalApi } from '../../core/medical.api';
import { PatientsApi } from '../../core/patients.api';
import { CreateStoreOrder, MedicalDocument, StoreOrder, UsablePrescription } from '../../core/model';
import { apiErrorMessage } from '../../core/api-error';
import { CardFields, emptyCard, readCard } from '../../shared/card-fields';

type RxMethod = 'code' | 'upload';
interface RxChoice { method: RxMethod; selected: string; typed: string; options: UsablePrescription[]; loading: boolean; }

const MAX_FILE_BYTES = 10 * 1024 * 1024;

@Component({
  selector: 'app-checkout',
  imports: [FormsModule, RouterLink, CurrencyPipe, DatePipe, CardFields],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (placed(); as o) {
      <section class="card success-card">
        <h1>{{ o.status === 'AwaitingReview' ? 'Order received' : 'Order ready for pickup' }}</h1>
        <p class="lead">Order <strong>{{ o.orderNumber }}</strong> · {{ o.total | currency: 'GEL' : 'symbol-narrow' }} paid</p>
        @if (o.status === 'AwaitingReview') {
          <p>Our staff will check your prescription, usually within a working day. You'll get a notification when it's ready to collect.
             If it can't be accepted, you'll be refunded in full.</p>
        } @else {
          <p>Collect it at the clinic pharmacy desk. Please bring a photo ID.</p>
        }
        <div class="card-actions">
          <a class="btn primary" routerLink="/orders">My orders</a>
          <a class="btn" routerLink="/store">Back to the store</a>
        </div>
      </section>
    } @else {
      <a class="back" routerLink="/store">← Back to the store</a>
      <h1>Checkout</h1>

      @if (cart.lines().length === 0) {
        <p class="empty card muted">Your cart is empty. <a routerLink="/store">Browse the store</a></p>
      } @else {
        <div class="checkout-layout">
          <div>
            <section class="card">
              <h3>Your items</h3>
              <ul class="cart-lines">
                @for (l of cart.lines(); track l.product.id) {
                  <li>
                    <div><strong>{{ l.product.name }}</strong> <span class="muted">× {{ l.quantity }}</span></div>
                    <span>{{ l.product.price * l.quantity | currency: 'GEL' : 'symbol-narrow' }}</span>
                  </li>
                }
              </ul>
              <p class="cart-total"><span>Total</span><strong>{{ cart.total() | currency: 'GEL' : 'symbol-narrow' }}</strong></p>
            </section>

            @if (rxLines().length > 0) {
              <section class="card section-gap">
                <h3>℞ Prescription</h3>
                <p class="muted small">These medicines can only be sold with a valid prescription in your name.</p>

                @for (l of rxLines(); track l.product.id) {
                  @if (choices()[l.product.id]; as c) {
                    <fieldset class="fieldset rx-line">
                      <legend>{{ l.product.name }}</legend>
                      <label class="check"><input type="radio" [name]="'rx-' + l.product.id" [checked]="c.method === 'code'" (change)="setMethod(l, 'code')" /> I have a prescription code</label>
                      @if (c.method === 'code') {
                        <div class="rx-code">
                          @if (c.loading) {
                            <p class="muted small">Looking for your prescriptions...</p>
                          } @else if (c.options.length > 0) {
                            <div class="field">
                              <label [for]="'rx-sel-' + l.product.id">Your prescriptions for this medicine</label>
                              <select [id]="'rx-sel-' + l.product.id" [(ngModel)]="c.selected" (ngModelChange)="c.typed = ''">
                                <option value="">Choose...</option>
                                @for (o of c.options; track o.id) {
                                  <option [value]="o.code">{{ o.code }} · {{ o.doctorName }} · valid until {{ o.expiryDate | date: 'd MMM y' }}</option>
                                }
                              </select>
                            </div>
                          }
                          <div class="field">
                            <label [for]="'rx-typed-' + l.product.id">{{ c.options.length > 0 ? 'Or enter a code' : 'Prescription code' }}</label>
                            <input [id]="'rx-typed-' + l.product.id" class="code-input" placeholder="RX-000000-XXXX" maxlength="30" autocomplete="off"
                              [(ngModel)]="c.typed" (ngModelChange)="c.selected = ''" />
                          </div>
                        </div>
                      }
                      <label class="check"><input type="radio" [name]="'rx-' + l.product.id" [checked]="c.method === 'upload'" (change)="setMethod(l, 'upload')" /> Upload a paper prescription</label>
                      <p class="small rx-request">
                        No prescription?
                        <a routerLink="/health" [queryParams]="{ tab: 'prescriptions', medicationId: l.product.medicationId, request: 1 }">Request one from a doctor</a>
                      </p>
                    </fieldset>
                  }
                }

                @if (anyUpload()) {
                  <div class="field">
                    <label for="rx-file">Prescription file (PDF, JPG or PNG, up to 10 MB)</label>
                    <input id="rx-file" type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" (change)="pickFile($event)" />
                    <small class="muted">Our staff check it before your order is ready. If it can't be accepted, you're refunded in full.</small>
                  </div>
                }
              </section>
            }
          </div>

          <section class="card pay-step">
            <h3>Payment</h3>
            <app-card-fields [card]="card" />
            @if (error()) { <p class="alert error" role="alert">{{ error() }}</p> }
            <button class="btn primary block" type="button" (click)="placeOrder()" [disabled]="busy()">
              {{ busy() ? 'Processing...' : 'Pay ' + (cart.total() | currency: 'GEL' : 'symbol-narrow') }}
            </button>
            <p class="muted small center">🔒 Card details are never stored. 📍 Collect at the clinic pharmacy desk.</p>
          </section>
        </div>
      }
    }
  `
})
export class CheckoutPage {
  private readonly api = inject(StoreApi);
  private readonly medical = inject(MedicalApi);
  private readonly patients = inject(PatientsApi);
  protected readonly cart = inject(CartService);

  protected readonly placed = signal<StoreOrder | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly choices = signal<Record<number, RxChoice>>({});
  protected readonly file = signal<File | null>(null);
  protected card = emptyCard();

  protected readonly rxLines = computed(() => this.cart.lines().filter(l => l.product.requiresPrescription));
  protected readonly anyUpload = computed(() => Object.values(this.choices()).some(c => c.method === 'upload'));

  constructor() {
    // Refresh stock and prices, then look up the patient's prescriptions for each prescription-only item.
    this.api.products().subscribe({ next: list => {
      this.cart.sync(list);
      this.loadChoices();
    } });
  }

  protected setMethod(line: CartLine, method: RxMethod): void {
    const all = { ...this.choices() };
    all[line.product.id] = { ...all[line.product.id], method };
    this.choices.set(all);
  }

  protected pickFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.error.set(null);
    if (file && file.size > MAX_FILE_BYTES) {
      this.error.set('The file is larger than 10 MB.');
      input.value = '';
      this.file.set(null);
      return;
    }
    this.file.set(file);
  }

  protected placeOrder(): void {
    const cardResult = readCard(this.card);
    const lines = this.cart.lines();
    const choices = this.choices();

    const items: CreateStoreOrder['items'] = [];
    for (const l of lines) {
      let code: string | null = null;
      if (l.product.requiresPrescription) {
        const c = choices[l.product.id];
        if (c?.method === 'code') {
          code = (c.selected || c.typed).trim();
          if (!code) {
            this.error.set(`Choose or enter a prescription code for ${l.product.name}, or upload a prescription.`);
            return;
          }
        }
      }
      items.push({ productId: l.product.id, quantity: l.quantity, prescriptionCode: code });
    }

    if (this.anyUpload() && !this.file()) {
      this.error.set('Choose the prescription file to upload.');
      return;
    }
    if ('error' in cardResult) {
      this.error.set(cardResult.error);
      return;
    }

    this.busy.set(true);
    this.error.set(null);

    const file = this.anyUpload() ? this.file() : null;
    const upload$: Observable<MedicalDocument | null> = file
      ? this.patients.me().pipe(switchMap(me =>
          this.medical.upload(me.id, file, 'Prescription', 'Prescription uploaded with a store order', null)))
      : of(null);

    upload$.pipe(
      switchMap(doc => this.api.placeOrder({ items, prescriptionDocumentId: doc?.id ?? null, card: cardResult.card }))
    ).subscribe({
      next: order => {
        this.busy.set(false);
        this.cart.clear();
        this.card = emptyCard();
        this.placed.set(order);
        window.scrollTo({ top: 0 });
      },
      error: err => {
        this.busy.set(false);
        this.error.set(apiErrorMessage(err));
      }
    });
  }

  private loadChoices(): void {
    const initial: Record<number, RxChoice> = {};
    for (const l of this.rxLines()) initial[l.product.id] = { method: 'code', selected: '', typed: '', options: [], loading: true };
    this.choices.set(initial);

    for (const l of this.rxLines()) {
      this.api.myPrescriptionsFor(l.product.id).subscribe({
        next: options => this.patch(l.product.id, { options, loading: false, selected: options.length === 1 ? options[0].code : '' }),
        error: () => this.patch(l.product.id, { loading: false })
      });
    }
  }

  private patch(productId: number, change: Partial<RxChoice>): void {
    const all = { ...this.choices() };
    all[productId] = { ...all[productId], ...change };
    this.choices.set(all);
  }
}
