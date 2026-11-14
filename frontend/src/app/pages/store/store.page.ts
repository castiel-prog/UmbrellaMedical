import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CATEGORY_INFO, StoreApi } from '../../core/store.api';
import { CartService, MAX_PER_PRODUCT } from '../../core/cart.service';
import { AuthService } from '../../core/auth.service';
import { Product, ProductCategory } from '../../core/model';
import { apiErrorMessage } from '../../core/api-error';

const CATEGORIES = Object.keys(CATEGORY_INFO) as ProductCategory[];

@Component({
  selector: 'app-store',
  imports: [FormsModule, RouterLink, CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head">
      <div>
        <h1>Umbrella store</h1>
        <p class="muted">Medicines, vitamins and everyday care. Pay online, collect at the clinic pharmacy desk.</p>
      </div>
    </div>

    <div class="store-layout">
      <section>
        <div class="store-filters">
          <label for="store-search" class="sr-only">Search products</label>
          <input id="store-search" type="search" placeholder="Search products..." [ngModel]="search()" (ngModelChange)="search.set($event)" />
          <div class="chips" role="group" aria-label="Categories">
            <button type="button" class="chip-btn" [class.on]="category() === null" (click)="setCategory(null)">All</button>
            @for (c of categories; track c) {
              <button type="button" class="chip-btn" [class.on]="category() === c" (click)="setCategory(c)">{{ info[c].icon }} {{ info[c].label }}</button>
            }
          </div>
          <label class="check">
            <input type="checkbox" [ngModel]="rxOnly()" (ngModelChange)="rxOnly.set($event)" /> Prescription medicines only
          </label>
        </div>

        @if (error()) { <p class="alert error" role="alert">{{ error() }}</p> }
        @if (loading()) { <p class="muted">Loading products...</p> }

        @if (!loading() && visible().length === 0) {
          <p class="empty card muted">No products match your search.</p>
        }

        <div class="product-grid">
          @for (p of visible(); track p.id) {
            <article class="product-card card">
              <div class="product-icon" [attr.data-cat]="p.category" aria-hidden="true">{{ info[p.category].icon }}</div>
              <div class="product-body">
                <h3>{{ p.name }}</h3>
                <p class="muted small">{{ p.unit }}</p>
                @if (p.requiresPrescription) {
                  <span class="badge rx-badge" title="You need a valid prescription to buy this">℞ Prescription needed</span>
                }
                <p class="small product-desc">{{ p.description }}</p>
              </div>
              <div class="product-foot">
                <strong class="price">{{ p.price | currency: 'GEL' : 'symbol-narrow' }}</strong>
                @if (p.stock === 0) {
                  <span class="muted small">Out of stock</span>
                } @else if (cart.quantityOf(p.id) === 0) {
                  <button class="btn primary small" type="button" (click)="cart.add(p)">Add to cart</button>
                } @else {
                  <div class="stepper" role="group" [attr.aria-label]="'Quantity of ' + p.name">
                    <button type="button" (click)="cart.setQuantity(p.id, cart.quantityOf(p.id) - 1)" aria-label="One less">−</button>
                    <span>{{ cart.quantityOf(p.id) }}</span>
                    <button type="button" (click)="cart.add(p)" [disabled]="cart.quantityOf(p.id) >= maxFor(p)" aria-label="One more">+</button>
                  </div>
                }
              </div>
              @if (p.stock > 0 && p.stock <= 5) { <p class="low-stock">Only {{ p.stock }} left</p> }
            </article>
          }
        </div>
      </section>

      <aside class="cart card" aria-label="Your cart">
        <h2 class="no-rule">🛒 Your cart</h2>
        @if (cart.lines().length === 0) {
          <p class="muted">Your cart is empty.</p>
        } @else {
          <ul class="cart-lines">
            @for (l of cart.lines(); track l.product.id) {
              <li>
                <div>
                  <strong>{{ l.product.name }}</strong>
                  @if (l.product.requiresPrescription) { <span class="rx-mini" title="Prescription needed">℞</span> }
                  <div class="muted small">{{ l.quantity }} × {{ l.product.price | currency: 'GEL' : 'symbol-narrow' }}</div>
                </div>
                <div class="cart-line-end">
                  <span>{{ l.product.price * l.quantity | currency: 'GEL' : 'symbol-narrow' }}</span>
                  <button type="button" class="link-like small" (click)="cart.remove(l.product.id)" [attr.aria-label]="'Remove ' + l.product.name">Remove</button>
                </div>
              </li>
            }
          </ul>
          <p class="cart-total"><span>Total</span><strong>{{ cart.total() | currency: 'GEL' : 'symbol-narrow' }}</strong></p>
          @if (cart.needsPrescription()) {
            <p class="muted small">℞ Some items need a prescription. You'll add your prescription code or upload a prescription at checkout.</p>
          }
          @if (canBuy()) {
            <a class="btn primary block" routerLink="/store/checkout">Go to checkout</a>
          } @else if (!auth.isLoggedIn()) {
            <a class="btn primary block" routerLink="/login" [queryParams]="{ returnUrl: '/store/checkout' }">Log in to check out</a>
          } @else {
            <p class="muted small">Online orders are for patient accounts.</p>
          }
        }
        <p class="muted small pickup-note">📍 Collect your order at the clinic pharmacy desk. Bring a photo ID.</p>
      </aside>
    </div>
  `
})
export class StorePage {
  private readonly api = inject(StoreApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly cart = inject(CartService);
  protected readonly auth = inject(AuthService);

  protected readonly categories = CATEGORIES;
  protected readonly info = CATEGORY_INFO;
  protected readonly products = signal<Product[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly search = signal('');
  protected readonly category = signal<ProductCategory | null>(this.initialCategory());
  protected readonly rxOnly = signal(false);

  protected readonly canBuy = computed(() => this.auth.hasRole('Patient'));

  protected readonly visible = computed(() => {
    const term = this.search().trim().toLowerCase();
    return this.products().filter(p =>
      (this.category() === null || p.category === this.category())
      && (!this.rxOnly() || p.requiresPrescription)
      && (!term || p.name.toLowerCase().includes(term) || (p.description ?? '').toLowerCase().includes(term)));
  });

  constructor() {
    this.api.products().subscribe({
      next: list => {
        this.products.set(list);
        this.cart.sync(list);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(apiErrorMessage(err));
        this.loading.set(false);
      }
    });
  }

  protected setCategory(category: ProductCategory | null): void {
    this.category.set(category);
    void this.router.navigate([], { queryParams: { category }, replaceUrl: true });
  }

  protected maxFor(p: Product): number {
    return Math.min(MAX_PER_PRODUCT, p.stock);
  }

  private initialCategory(): ProductCategory | null {
    const value = this.route.snapshot.queryParamMap.get('category') as ProductCategory | null;
    return value && value in CATEGORY_INFO ? value : null;
  }
}
