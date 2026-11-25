import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { CurrencyPipe } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CATEGORY_INFO, StoreApi } from '../../core/store.api';
import { CartService, MAX_PER_PRODUCT } from '../../core/cart.service';
import { AuthService } from '../../core/auth.service';
import { DeliveryInfo, Product } from '../../core/model';
import { apiErrorMessage } from '../../core/api-error';
import { ProductImage } from '../../shared/product-image';
import { I18n, TranslatePipe } from '../../core/i18n';

/** One pharmacy product: photo, price, stock, how to buy it (prescription), delivery, and similar products. */
@Component({
  selector: 'app-product',
  imports: [RouterLink, CurrencyPipe, ProductImage, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="crumbs small" [attr.aria-label]="'Breadcrumb' | t">
      <a routerLink="/pharmacy">{{ 'Pharmacy' | t }}</a>
      @if (product(); as p) {
        <span aria-hidden="true">›</span>
        <a routerLink="/pharmacy" [queryParams]="{ category: p.category }">{{ info[p.category].label | t }}</a>
        <span aria-hidden="true">›</span>
        <span class="muted">{{ p.name }}</span>
      }
    </nav>

    @if (error()) { <p class="alert error" role="alert">{{ error() }}</p> }
    @if (loading()) { <p class="muted">{{ 'Loading...' | t }}</p> }

    @if (!loading() && !product() && !error()) {
      <div class="empty card center">
        <p>{{ 'This product is not available.' | t }}</p>
        <a class="btn primary" routerLink="/pharmacy">{{ 'Back to the pharmacy' | t }}</a>
      </div>
    }

    @if (product(); as p) {
      <article class="pd-layout">
        <div class="pd-photo card">
          <app-product-image class="pd-image" [attr.data-cat]="p.category"
            [name]="p.name" [category]="p.category" [imageUrl]="p.imageUrl" [rx]="p.requiresPrescription" />
        </div>

        <div class="pd-main">
          <span class="pd-cat">{{ info[p.category].icon }} {{ info[p.category].label | t }}</span>
          <h1>{{ p.name }}</h1>
          @if (p.unit) { <p class="muted pd-unit">{{ p.unit }}</p> }

          <div class="pd-badges">
            @if (p.requiresPrescription) {
              <span class="badge rx-badge">℞ {{ 'Prescription needed' | t }}</span>
            } @else {
              <span class="badge pd-otc">✓ {{ 'No prescription needed' | t }}</span>
            }
            @if (p.stock === 0) {
              <span class="badge pd-out">{{ 'Out of stock' | t }}</span>
            } @else if (p.stock <= 5) {
              <span class="badge pd-low">{{ 'Only {n} left' | t: { n: p.stock } }}</span>
            } @else {
              <span class="badge pd-in">● {{ 'In stock' | t }}</span>
            }
          </div>

          <p class="pd-price">{{ p.price | currency: 'GEL' : 'symbol-narrow' }}</p>

          @if (p.stock > 0) {
            <div class="pd-buy">
              <div class="stepper pd-qty" role="group" [attr.aria-label]="'Quantity' | t">
                <button type="button" (click)="qty.set(qty() - 1)" [disabled]="qty() <= 1" [attr.aria-label]="'One less' | t">−</button>
                <span>{{ qty() }}</span>
                <button type="button" (click)="qty.set(qty() + 1)" [disabled]="qty() >= maxQty()" [attr.aria-label]="'One more' | t">+</button>
              </div>
              <button class="btn primary pd-add" type="button" (click)="addToCart(p)" [disabled]="inCart() >= maxQty()">
                🛒 {{ 'Add to cart' | t }} · {{ p.price * qty() | currency: 'GEL' : 'symbol-narrow' }}
              </button>
            </div>
            @if (inCart() > 0) {
              <p class="pd-incart small">
                ✓ {{ 'In your cart: {n}' | t: { n: inCart() } }} ·
                @if (auth.isLoggedIn()) {
                  <a routerLink="/pharmacy/checkout">{{ 'Go to checkout' | t }}</a>
                } @else {
                  <a routerLink="/login" [queryParams]="{ returnUrl: '/pharmacy/checkout' }">{{ 'Log in to check out' | t }}</a>
                }
              </p>
            }
          }

          @if (p.description) {
            <section class="pd-section">
              <h2 class="no-rule">{{ 'About this product' | t }}</h2>
              <p>{{ p.description }}</p>
            </section>
          }

          @if (p.requiresPrescription) {
            <section class="pd-section pd-rx">
              <h2 class="no-rule">℞ {{ 'How to buy with a prescription' | t }}</h2>
              @if (p.medicationName) { <p class="small muted">{{ 'Active substance: {name}' | t: { name: p.medicationName } }}</p> }
              <ol class="pd-steps">
                <li>{{ 'Add it to your cart and go to checkout.' | t }}</li>
                <li>{{ 'Enter the prescription code from your doctor, or upload a photo of a paper prescription.' | t }}</li>
                <li>{{ 'Our pharmacist checks it, then your order is prepared.' | t }}</li>
              </ol>
              <p class="small">
                {{ 'No prescription?' | t }}
                <a routerLink="/health" [queryParams]="{ tab: 'prescriptions', medicationId: p.medicationId, request: 1 }">{{ 'Request one from a doctor' | t }}</a>
              </p>
            </section>
          }

          <section class="pd-section pd-get">
            <div>
              <span class="pd-get-icon" aria-hidden="true">🚚</span>
              <div>
                <strong>{{ 'Home delivery' | t }}</strong>
                <p class="small muted">
                  {{ 'Tbilisi, within {hours} hours' | t: { hours: delivery()?.withinHours ?? 24 } }} ·
                  {{ (delivery()?.fee ?? 5) | currency: 'GEL' : 'symbol-narrow' }},
                  {{ 'free from {amount}' | t: { amount: ((delivery()?.freeFrom ?? 50) | currency: 'GEL' : 'symbol-narrow') } }}
                </p>
              </div>
            </div>
            <div>
              <span class="pd-get-icon" aria-hidden="true">🏥</span>
              <div>
                <strong>{{ 'Pick up at the clinic' | t }}</strong>
                <p class="small muted">{{ '12 Shota Rustaveli Avenue, Tbilisi · open 24/7' | t }} · {{ 'Free' | t }}</p>
              </div>
            </div>
          </section>
        </div>
      </article>

      @if (similar().length > 0) {
        <section class="pd-similar">
          <h2>{{ 'Similar products' | t }}</h2>
          <div class="product-grid">
            @for (s of similar(); track s.id) {
              <a class="product-card card pd-mini" [routerLink]="['/pharmacy', s.id]">
                <app-product-image class="product-pic" [attr.data-cat]="s.category"
                  [name]="s.name" [category]="s.category" [imageUrl]="s.imageUrl" [rx]="s.requiresPrescription" />
                <div class="product-body">
                  <h3>{{ s.name }}</h3>
                  <p class="muted small">{{ s.unit }}</p>
                </div>
                <div class="product-foot"><strong class="price">{{ s.price | currency: 'GEL' : 'symbol-narrow' }}</strong></div>
              </a>
            }
          </div>
        </section>
      }
    }
  `
})
export class ProductPage {
  private readonly api = inject(StoreApi);
  private readonly i18n = inject(I18n);
  private readonly title = inject(Title);
  protected readonly cart = inject(CartService);
  protected readonly auth = inject(AuthService);

  /** Route parameter :id (it changes when a similar product is opened). */
  private readonly id = toSignal(inject(ActivatedRoute).paramMap.pipe(map(p => p.get('id') ?? '')), { initialValue: '' });

  protected readonly info = CATEGORY_INFO;
  protected readonly all = signal<Product[]>([]);
  protected readonly delivery = signal<DeliveryInfo | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly qty = signal(1);

  protected readonly product = computed(() => this.all().find(p => p.id === Number(this.id())) ?? null);
  protected readonly inCart = computed(() => { const p = this.product(); return p ? this.cart.quantityOf(p.id) : 0; });
  /** At most the per-product limit and what's in stock, minus what's already in the cart. */
  protected readonly maxQty = computed(() => {
    const p = this.product();
    return p ? Math.max(1, Math.min(MAX_PER_PRODUCT, p.stock) - this.inCart()) : 1;
  });
  /** Up to four other products of the same category, prescription status first matching. */
  protected readonly similar = computed(() => {
    const p = this.product();
    if (!p) return [];
    return this.all()
      .filter(o => o.id !== p.id && o.category === p.category && o.stock > 0)
      .sort((a, b) => Number(b.requiresPrescription === p.requiresPrescription) - Number(a.requiresPrescription === p.requiresPrescription))
      .slice(0, 4);
  });

  constructor() {
    this.api.products().subscribe({
      next: list => { this.all.set(list); this.cart.sync(list); this.loading.set(false); },
      error: err => { this.error.set(apiErrorMessage(err)); this.loading.set(false); }
    });
    this.api.deliveryInfo().subscribe({ next: d => this.delivery.set(d) });

    // Browser tab shows the product name; a new product (similar products) starts at quantity 1 at the top.
    effect(() => {
      const p = this.product();
      if (p) this.title.setTitle(`${p.name} · ${this.i18n.t('Umbrella pharmacy')}`);
      this.qty.set(1);
      window.scrollTo({ top: 0 });
    });
  }

  protected addToCart(p: Product): void {
    const amount = Math.min(this.qty(), this.maxQty());
    this.cart.add(p, amount);
    this.qty.set(1);
  }
}
