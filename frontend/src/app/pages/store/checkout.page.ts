import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
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
import { ProductImage } from '../../shared/product-image';
import { I18n, LocalDatePipe, TranslatePipe } from '../../core/i18n';
import { AuthService } from '../../core/auth.service';

type RxMethod = 'code' | 'upload';
interface RxChoice { method: RxMethod; selected: string; typed: string; options: UsablePrescription[]; loading: boolean; }

const MAX_FILE_BYTES = 10 * 1024 * 1024;

@Component({
  selector: 'app-checkout',
  imports: [FormsModule, RouterLink, CurrencyPipe, CardFields, ProductImage, TranslatePipe, LocalDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (placed(); as o) {
      <section class="card success-card">
        <h1>{{ (o.status === 'AwaitingReview' ? 'Order received' : 'Order ready for pickup') | t }}</h1>
        <p class="lead">{{ 'Order {number} · {total} paid' | t: { number: o.orderNumber, total: (o.total | currency: 'GEL' : 'symbol-narrow') } }}</p>
        @if (o.status === 'AwaitingReview') {
          <p>{{ 'Our pharmacist will check your prescription, usually within a working day. You\\'ll get a notification when your order is ready to collect. If it can\\'t be accepted, you\\'ll be refunded in full.' | t }}</p>
        } @else {
          <p>{{ 'Collect it at the clinic pharmacy desk. Please bring a photo ID.' | t }}</p>
        }
        @if (!isPatient() && o.customerEmail) {
          <p class="muted">{{ 'We emailed the order details to {email}. Show your order number at the pharmacy desk.' | t: { email: o.customerEmail } }}</p>
        }
        <div class="card-actions">
          @if (isPatient()) {
            <a class="btn primary" routerLink="/orders">{{ 'My orders' | t }}</a>
          }
          <a class="btn" [class.primary]="!isPatient()" routerLink="/pharmacy">{{ 'Back to the pharmacy' | t }}</a>
        </div>
      </section>
    } @else {
      <a class="back" routerLink="/pharmacy">← {{ 'Back to the pharmacy' | t }}</a>
      <h1>{{ 'Checkout' | t }}</h1>

      @if (cart.lines().length === 0) {
        <p class="empty card muted">{{ 'Your cart is empty.' | t }} <a routerLink="/pharmacy">{{ 'Browse the pharmacy' | t }}</a></p>
      } @else {
        <div class="checkout-layout">
          <div>
            <section class="card">
              <h3>{{ 'Your items' | t }}</h3>
              <ul class="cart-lines">
                @for (l of cart.lines(); track l.product.id) {
                  <li>
                    <app-product-image class="cart-thumb" [attr.data-cat]="l.product.category"
                      [name]="l.product.name" [category]="l.product.category" [imageUrl]="l.product.imageUrl" />
                    <div class="grow"><strong>{{ l.product.name }}</strong> <span class="muted">× {{ l.quantity }}</span></div>
                    <span>{{ l.product.price * l.quantity | currency: 'GEL' : 'symbol-narrow' }}</span>
                  </li>
                }
              </ul>
              <p class="cart-total"><span>{{ 'Total' | t }}</span><strong>{{ cart.total() | currency: 'GEL' : 'symbol-narrow' }}</strong></p>
            </section>

            @if (!isPatient()) {
              <section class="card section-gap">
                <h3>{{ 'Your details' | t }}</h3>
                <p class="muted small">{{ 'We use these only for this order: to send your receipt and tell you when it is ready.' | t }}</p>
                <div class="field">
                  <label for="co-name">{{ 'Full name' | t }}</label>
                  <input id="co-name" name="name" autocomplete="name" maxlength="100" [(ngModel)]="contact.name" />
                </div>
                <div class="form-grid">
                  <div class="field">
                    <label for="co-email">{{ 'Email' | t }}</label>
                    <input id="co-email" name="email" type="email" autocomplete="email" maxlength="256" [(ngModel)]="contact.email" />
                  </div>
                  <div class="field">
                    <label for="co-phone">{{ 'Phone' | t }}</label>
                    <input id="co-phone" name="phone" type="tel" autocomplete="tel" maxlength="30" placeholder="+995 5XX XX XX XX" [(ngModel)]="contact.phone" />
                  </div>
                </div>
              </section>
            }

            @if (rxLines().length > 0) {
              <section class="card section-gap">
                <h3>℞ {{ 'Prescription' | t }}</h3>
                @if (isPatient()) {
                  <p class="muted small">{{ 'These medicines can only be sold with a valid prescription in your name.' | t }}</p>
                } @else {
                  <p class="muted small">{{ 'These medicines can only be sold with a valid prescription. Enter the prescription code and the personal number of the patient it was written for.' | t }}</p>
                  <div class="field">
                    <label for="co-pn">{{ 'Patient\\'s personal number' | t }}</label>
                    <input id="co-pn" name="personalNumber" inputmode="numeric" maxlength="20" autocomplete="off" [(ngModel)]="contact.personalNumber" />
                  </div>
                }

                @for (l of rxLines(); track l.product.id) {
                  @if (choices()[l.product.id]; as c) {
                    <fieldset class="fieldset rx-line">
                      <legend>{{ l.product.name }}</legend>
                      <label class="check"><input type="radio" [name]="'rx-' + l.product.id" [checked]="c.method === 'code'" (change)="setMethod(l, 'code')" /> {{ 'I have a prescription code' | t }}</label>
                      @if (c.method === 'code') {
                        <div class="rx-code">
                          @if (c.loading) {
                            <p class="muted small">{{ 'Looking for your prescriptions...' | t }}</p>
                          } @else if (c.options.length > 0) {
                            <div class="field">
                              <label [for]="'rx-sel-' + l.product.id">{{ 'Your prescriptions for this medicine' | t }}</label>
                              <select [id]="'rx-sel-' + l.product.id" [(ngModel)]="c.selected" (ngModelChange)="c.typed = ''">
                                <option value="">{{ 'Choose...' | t }}</option>
                                @for (o of c.options; track o.id) {
                                  <option [value]="o.code">{{ o.code }} · {{ o.doctorName }} · {{ 'valid until {date}' | t: { date: (o.expiryDate | ldate) } }}</option>
                                }
                              </select>
                            </div>
                          }
                          <div class="field">
                            <label [for]="'rx-typed-' + l.product.id">{{ (c.options.length > 0 ? 'Or enter a code' : 'Prescription code') | t }}</label>
                            <input [id]="'rx-typed-' + l.product.id" class="code-input" placeholder="RX-000000-XXXX" maxlength="30" autocomplete="off"
                              [(ngModel)]="c.typed" (ngModelChange)="c.selected = ''" />
                          </div>
                        </div>
                      }
                      @if (isPatient()) {
                        <label class="check"><input type="radio" [name]="'rx-' + l.product.id" [checked]="c.method === 'upload'" (change)="setMethod(l, 'upload')" /> {{ 'Upload a paper prescription' | t }}</label>
                        <p class="small rx-request">
                          {{ 'No prescription?' | t }}
                          <a routerLink="/health" [queryParams]="{ tab: 'prescriptions', medicationId: l.product.medicationId, request: 1 }">{{ 'Request one from a doctor' | t }}</a>
                        </p>
                      }
                    </fieldset>
                  }
                }

                @if (anyUpload()) {
                  <div class="field">
                    <label for="rx-file">{{ 'Prescription file (PDF, JPG or PNG, up to 10 MB)' | t }}</label>
                    <input id="rx-file" type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" (change)="pickFile($event)" />
                    <small class="muted">{{ 'Our pharmacist checks it before your order is ready. If it can\\'t be accepted, you\\'re refunded in full.' | t }}</small>
                  </div>
                }
              </section>
            }
          </div>

          <section class="card pay-step">
            <h3>{{ 'Payment' | t }}</h3>
            <app-card-fields [card]="card" />
            @if (error()) { <p class="alert error" role="alert">{{ error() }}</p> }
            <button class="btn primary block" type="button" (click)="placeOrder()" [disabled]="busy()">
              {{ busy() ? ('Processing...' | t) : ('Pay {amount}' | t: { amount: (cart.total() | currency: 'GEL' : 'symbol-narrow') }) }}
            </button>
            <p class="muted small center">🔒 {{ 'Secure payment. Card details are never stored.' | t }}</p>
            <p class="muted small center">📍 {{ 'Collect your order at the clinic pharmacy desk. Bring a photo ID.' | t }}</p>
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
  private readonly i18n = inject(I18n);
  protected readonly auth = inject(AuthService);
  /** Patients order on their account; everyone else (visitors and staff) gives contact details. */
  protected readonly isPatient = computed(() => this.auth.hasRole('Patient'));
  protected contact = { name: '', email: this.auth.hasRole('Patient') ? '' : (this.auth.email() ?? ''), phone: '', personalNumber: '' };

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
      this.error.set(this.i18n.t('The file is larger than 10 MB.'));
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
            this.error.set(this.isPatient()
              ? this.i18n.t('Choose or enter a prescription code for {name}, or upload a prescription.', { name: l.product.name })
              : this.i18n.t('Enter the prescription code for {name}.', { name: l.product.name }));
            return;
          }
        }
      }
      items.push({ productId: l.product.id, quantity: l.quantity, prescriptionCode: code });
    }

    let customer: CreateStoreOrder['customer'] = null;
    if (!this.isPatient()) {
      const c = { name: this.contact.name.trim(), email: this.contact.email.trim(), phone: this.contact.phone.trim(), personalNumber: this.contact.personalNumber.trim() || null };
      if (c.name.length < 2) { this.error.set(this.i18n.t('Enter your full name.')); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) { this.error.set(this.i18n.t('Enter a valid email address.')); return; }
      if (c.phone.replace(/\D/g, '').length < 6) { this.error.set(this.i18n.t('Enter a valid phone number.')); return; }
      if (this.rxLines().length > 0 && !c.personalNumber) { this.error.set(this.i18n.t('Enter the personal number of the patient the prescription is for.')); return; }
      customer = c;
    }

    if (this.anyUpload() && !this.file()) {
      this.error.set(this.i18n.t('Choose the prescription file to upload.'));
      return;
    }
    if ('error' in cardResult) {
      this.error.set(this.i18n.t(cardResult.error));
      return;
    }

    this.busy.set(true);
    this.error.set(null);

    const file = this.anyUpload() ? this.file() : null;
    const upload$: Observable<MedicalDocument | null> = file
      ? this.patients.me().pipe(switchMap(me =>
          this.medical.upload(me.id, file, 'Prescription', 'Prescription uploaded with a pharmacy order', null)))
      : of(null);

    upload$.pipe(
      switchMap(doc => this.api.placeOrder({ items, prescriptionDocumentId: doc?.id ?? null, card: cardResult.card, customer }))
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
    for (const l of this.rxLines()) initial[l.product.id] = { method: 'code', selected: '', typed: '', options: [], loading: this.isPatient() };
    this.choices.set(initial);
    if (!this.isPatient()) return; // saved prescriptions exist only for patient accounts

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
