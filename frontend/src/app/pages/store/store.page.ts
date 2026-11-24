import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CATEGORY_INFO, StoreApi } from '../../core/store.api';
import { CartService, MAX_PER_PRODUCT } from '../../core/cart.service';
import { Product, ProductCategory } from '../../core/model';
import { apiErrorMessage } from '../../core/api-error';
import { ProductImage } from '../../shared/product-image';
import { Pager } from '../../shared/pager';
import { I18n, TranslatePipe } from '../../core/i18n';
import { AuthService } from '../../core/auth.service';

const CATEGORIES = Object.keys(CATEGORY_INFO) as ProductCategory[];

type PriceBand = 'any' | 'u10' | '10-25' | '25-50' | '50+';
type RxFilter = 'all' | 'otc' | 'rx';
type SortId = 'featured' | 'name' | 'priceAsc' | 'priceDesc';
type FilterId = 'search' | 'category' | 'price' | 'rx' | 'stock';

/** Price ranges in GEL (min included, max excluded). */
const PRICE_BANDS: { id: PriceBand; label: string; price: string; min: number; max: number }[] = [
  { id: 'any', label: 'Any price', price: '', min: 0, max: Infinity },
  { id: 'u10', label: 'Under {price}', price: '₾10', min: 0, max: 10 },
  { id: '10-25', label: '{price}', price: '₾10–25', min: 10, max: 25 },
  { id: '25-50', label: '{price}', price: '₾25–50', min: 25, max: 50 },
  { id: '50+', label: '{price} and over', price: '₾50', min: 50, max: Infinity }
];

@Component({
  selector: 'app-store',
  imports: [TranslatePipe, FormsModule, RouterLink, CurrencyPipe, ProductImage, Pager],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head">
      <div>
        <h1>{{ 'Umbrella pharmacy' | t }}</h1>
        <p class="muted">{{ 'Medicines, vitamins and everyday care. Pay online, collect at the clinic pharmacy desk.' | t }}</p>
      </div>
    </div>

    @if (cart.count() > 0) {
      <!-- Tablets and phones: the cart total and checkout stay in reach while scrolling the products. -->
      <div class="cart-bar" role="region" [attr.aria-label]="'Your cart' | t">
        <span class="cart-bar-sum">🛒 {{ 'Items in cart: {n}' | t: { n: cart.count() } }} · <strong>{{ cart.total() | currency: 'GEL' : 'symbol-narrow' }}</strong></span>
        @if (auth.isLoggedIn()) {
          <a class="btn primary small" routerLink="/pharmacy/checkout">{{ 'Checkout' | t }}</a>
        } @else {
          <a class="btn primary small" routerLink="/login" [queryParams]="{ returnUrl: '/pharmacy/checkout' }">{{ 'Log in to check out' | t }}</a>
        }

      </div>
    }
    <div class="store-layout">
      <section>
        <!-- Filters: search and sort, category tiles with live counts, then price / prescription / stock -->
        <section class="card shop-filters" id="products-top" [attr.aria-label]="'Filters' | t">
          <div class="shop-search-row">
            <div class="shop-search">
              <span class="shop-search-icon" aria-hidden="true">🔍</span>
              <label for="store-search" class="sr-only">{{ 'Search products' | t }}</label>
              <input id="store-search" type="search" [placeholder]="'Search products...' | t" [ngModel]="search()" (ngModelChange)="search.set($event); setPage(1, false)" />
            </div>
            <div class="shop-sort">
              <label for="store-sort">{{ 'Sort by' | t }}</label>
              <select id="store-sort" [ngModel]="sort()" (ngModelChange)="sort.set($event); setPage(1, false)">
                @for (s of sorts; track s.id) { <option [value]="s.id">{{ s.label | t }}</option> }
              </select>
            </div>
          </div>

          <div class="cat-tiles" role="group" [attr.aria-label]="'Categories' | t">
            <button type="button" class="cat-tile" [class.on]="category() === null" [attr.aria-pressed]="category() === null" (click)="setCategory(null)">
              <span class="cat-icon" aria-hidden="true">🏥</span>
              <span class="cat-name">{{ 'All products' | t }}</span>
              <span class="cat-count">{{ countFor(null) }}</span>
            </button>
            @for (c of categories; track c) {
              <button type="button" class="cat-tile" [class.on]="category() === c" [attr.aria-pressed]="category() === c" (click)="setCategory(c)">
                <span class="cat-icon" aria-hidden="true">{{ info[c].icon }}</span>
                <span class="cat-name">{{ info[c].label | t }}</span>
                <span class="cat-count">{{ countFor(c) }}</span>
              </button>
            }
          </div>

          <div class="shop-refine">
            <div class="refine-group" role="radiogroup" [attr.aria-label]="'Price' | t">
              <span class="refine-label">{{ 'Price' | t }}</span>
              <div class="pill-set">
                @for (b of priceBands; track b.id) {
                  <button type="button" class="pill" role="radio" [class.on]="price() === b.id" [attr.aria-checked]="price() === b.id" (click)="price.set(b.id); setPage(1, false)">{{ b.label | t: { price: b.price } }}</button>
                }
              </div>
            </div>
            <div class="refine-group" role="radiogroup" [attr.aria-label]="'Prescription' | t">
              <span class="refine-label">{{ 'Prescription' | t }}</span>
              <div class="pill-set">
                @for (r of rxOptions; track r.id) {
                  <button type="button" class="pill" role="radio" [class.on]="rx() === r.id" [attr.aria-checked]="rx() === r.id" (click)="rx.set(r.id); setPage(1, false)">{{ r.label | t }}</button>
                }
              </div>
            </div>
            <label class="switch">
              <input type="checkbox" role="switch" [ngModel]="inStock()" (ngModelChange)="inStock.set($event); setPage(1, false)" />
              <span class="switch-track" aria-hidden="true"></span>
              {{ 'In stock only' | t }}
            </label>
          </div>
        </section>

        @if (error()) { <p class="alert error" role="alert">{{ error() }}</p> }
        @if (loading()) { <p class="muted">{{ 'Loading products...' | t }}</p> }

        @if (!loading()) {
          <div class="shop-results-bar">
            <p class="muted small results-count">
              @if (visible().length > 0) {
                {{ 'Showing {from}–{to} of {total} products' | t: { from: (currentPage() - 1) * pageSize + 1, to: (currentPage() - 1) * pageSize + paged().length, total: visible().length } }}
              } @else {
                {{ 'No products match your search.' | t }}
              }
            </p>
            @if (activeFilters().length > 0) {
              <div class="active-filters">
                @for (f of activeFilters(); track f.id) {
                  <button type="button" class="active-chip" (click)="clearFilter(f.id)" [attr.aria-label]="'Remove filter {name}' | t: { name: f.text }">{{ f.text }} <span aria-hidden="true">×</span></button>
                }
                <button type="button" class="link-like small" (click)="clearAll()">{{ 'Clear all' | t }}</button>
              </div>
            }
          </div>
        }

        @if (!loading() && visible().length === 0) {
          <div class="empty card muted center">
            <p>{{ 'Try a different search or fewer filters.' | t }}</p>
            <button type="button" class="btn small" (click)="clearAll()">{{ 'Clear all' | t }}</button>
          </div>
        }

        <div class="product-grid">
          @for (p of paged(); track p.id) {
            <article class="product-card card">
              <app-product-image class="product-pic" [attr.data-cat]="p.category"
                [name]="p.name" [category]="p.category" [imageUrl]="p.imageUrl" [rx]="p.requiresPrescription" />
              <div class="product-body">
                <h3>{{ p.name }}</h3>
                <p class="muted small">{{ p.unit }}</p>
                @if (p.requiresPrescription) {
                  <span class="badge rx-badge" [title]="'You need a valid prescription to buy this' | t">℞ {{ 'Prescription needed' | t }}</span>
                }
                <p class="small product-desc">{{ p.description }}</p>
              </div>
              <div class="product-foot">
                <strong class="price">{{ p.price | currency: 'GEL' : 'symbol-narrow' }}</strong>
                @if (p.stock === 0) {
                  <span class="muted small">{{ 'Out of stock' | t }}</span>
                } @else if (cart.quantityOf(p.id) === 0) {
                  <button class="btn primary small" type="button" (click)="cart.add(p)">{{ 'Add to cart' | t }}</button>
                } @else {
                  <div class="stepper" role="group" [attr.aria-label]="'Quantity of {name}' | t: { name: p.name }">
                    <button type="button" (click)="cart.setQuantity(p.id, cart.quantityOf(p.id) - 1)" [attr.aria-label]="'One less' | t">−</button>
                    <span>{{ cart.quantityOf(p.id) }}</span>
                    <button type="button" (click)="cart.add(p)" [disabled]="cart.quantityOf(p.id) >= maxFor(p)" [attr.aria-label]="'One more' | t">+</button>
                  </div>
                }
              </div>
              @if (p.stock > 0 && p.stock <= 5) { <p class="low-stock">{{ 'Only {n} left' | t: { n: p.stock } }}</p> }
            </article>
          }
        </div>
        <app-pager [page]="currentPage()" [pageSize]="pageSize" [totalCount]="visible().length" (pageChange)="setPage($event, true)" />
      </section>

      <aside class="cart card" [class.is-empty]="cart.lines().length === 0" [attr.aria-label]="'Your cart' | t">
        <h2 class="no-rule">🛒 {{ 'Your cart' | t }}</h2>
        @if (cart.lines().length === 0) {
          <p class="muted">{{ 'Your cart is empty.' | t }}</p>
        } @else {
          <ul class="cart-lines">
            @for (l of cart.lines(); track l.product.id) {
              <li>
                <app-product-image class="cart-thumb" [attr.data-cat]="l.product.category"
                  [name]="l.product.name" [category]="l.product.category" [imageUrl]="l.product.imageUrl" />
                <div class="grow">
                  <strong>{{ l.product.name }}</strong>
                  @if (l.product.requiresPrescription) { <span class="rx-mini" [title]="'Prescription needed' | t">℞</span> }
                  <div class="muted small">{{ l.quantity }} × {{ l.product.price | currency: 'GEL' : 'symbol-narrow' }}</div>
                </div>
                <div class="cart-line-end">
                  <span>{{ l.product.price * l.quantity | currency: 'GEL' : 'symbol-narrow' }}</span>
                  <button type="button" class="link-like small" (click)="cart.remove(l.product.id)" [attr.aria-label]="'Remove {name}' | t: { name: l.product.name }">{{ 'Remove' | t }}</button>
                </div>
              </li>
            }
          </ul>
          <p class="cart-total"><span>{{ 'Total' | t }}</span><strong>{{ cart.total() | currency: 'GEL' : 'symbol-narrow' }}</strong></p>
          @if (cart.needsPrescription()) {
            <p class="muted small">℞ {{ 'Some items need a prescription. You\\'ll add your prescription code or upload a prescription at checkout.' | t }}</p>
          }
          @if (auth.isLoggedIn()) {
            <a class="btn primary block" routerLink="/pharmacy/checkout">{{ 'Go to checkout' | t }}</a>
          } @else {
            <a class="btn primary block" routerLink="/login" [queryParams]="{ returnUrl: '/pharmacy/checkout' }">{{ 'Log in to check out' | t }}</a>
            <p class="muted small center">{{ 'New here?' | t }} <a routerLink="/register" [queryParams]="{ returnUrl: '/pharmacy/checkout' }">{{ 'Create an account' | t }}</a></p>
          }

        }
        <p class="muted small pickup-note">🚚 {{ 'Home delivery in Tbilisi, free from {amount}.' | t: { amount: '₾50' } }}<br />📍 {{ 'Or collect your order at the clinic pharmacy desk.' | t }}</p>
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
  private readonly i18n = inject(I18n);

  protected readonly categories = CATEGORIES;
  protected readonly info = CATEGORY_INFO;
  protected readonly products = signal<Product[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly search = signal('');
  protected readonly category = signal<ProductCategory | null>(this.initialCategory());
  protected readonly price = signal<PriceBand>('any');
  protected readonly rx = signal<RxFilter>('all');
  protected readonly inStock = signal(false);
  protected readonly sort = signal<SortId>('featured');

  protected readonly sorts: { id: SortId; label: string }[] = [
    { id: 'featured', label: 'Featured' },
    { id: 'name', label: 'Name A–Z' },
    { id: 'priceAsc', label: 'Price: low to high' },
    { id: 'priceDesc', label: 'Price: high to low' }
  ];
  protected readonly priceBands = PRICE_BANDS;
  protected readonly rxOptions: { id: RxFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'otc', label: 'No prescription' },
    { id: 'rx', label: 'Prescription only' }
  ];

  /** Nine products per page (a 3 x 3 grid on desktop). */
  protected readonly pageSize = 9;
  protected readonly page = signal(this.initialPage());

  /** Products matching everything except the category (the category tiles count from these). */
  private readonly refined = computed(() => {
    const term = this.search().trim().toLowerCase();
    const band = PRICE_BANDS.find(b => b.id === this.price())!;
    return this.products().filter(p =>
      p.price >= band.min && p.price < band.max
      && (this.rx() === 'all' || p.requiresPrescription === (this.rx() === 'rx'))
      && (!this.inStock() || p.stock > 0)
      && (!term || p.name.toLowerCase().includes(term) || (p.description ?? '').toLowerCase().includes(term)));
  });

  protected readonly visible = computed(() => {
    const list = this.refined().filter(p => this.category() === null || p.category === this.category());
    const lang = this.i18n.locale();
    switch (this.sort()) {
      case 'name': return [...list].sort((a, b) => a.name.localeCompare(b.name, lang));
      case 'priceAsc': return [...list].sort((a, b) => a.price - b.price);
      case 'priceDesc': return [...list].sort((a, b) => b.price - a.price);
      default: return list;
    }
  });

  private readonly counts = computed(() => {
    const map = new Map<ProductCategory | null, number>([[null, this.refined().length]]);
    for (const p of this.refined()) map.set(p.category, (map.get(p.category) ?? 0) + 1);
    return map;
  });

  /** The filters in use, shown as removable chips above the products. */
  protected readonly activeFilters = computed(() => {
    const list: { id: FilterId; text: string }[] = [];
    const t = (s: string, p?: Record<string, string | number>) => this.i18n.t(s, p);
    if (this.search().trim()) list.push({ id: 'search', text: `“${this.search().trim()}”` });
    const c = this.category();
    if (c) list.push({ id: 'category', text: t(CATEGORY_INFO[c].label) });
    const band = PRICE_BANDS.find(b => b.id === this.price())!;
    if (band.id !== 'any') list.push({ id: 'price', text: t(band.label, { price: band.price }) });
    if (this.rx() !== 'all') list.push({ id: 'rx', text: t(this.rx() === 'rx' ? 'Prescription only' : 'No prescription') });
    if (this.inStock()) list.push({ id: 'stock', text: t('In stock only') });
    return list;
  });

  protected countFor(category: ProductCategory | null): number {
    return this.counts().get(category) ?? 0;
  }

  protected clearFilter(id: FilterId): void {
    switch (id) {
      case 'search': this.search.set(''); break;
      case 'category': this.setCategory(null); return;
      case 'price': this.price.set('any'); break;
      case 'rx': this.rx.set('all'); break;
      case 'stock': this.inStock.set(false); break;
    }
    this.setPage(1, false);
  }

  protected clearAll(): void {
    this.search.set('');
    this.price.set('any');
    this.rx.set('all');
    this.inStock.set(false);
    this.setCategory(null);
  }

  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.visible().length / this.pageSize)));
  /** The page asked for, kept within range when a filter leaves fewer pages. */
  protected readonly currentPage = computed(() => Math.min(this.page(), this.totalPages()));
  protected readonly paged = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.visible().slice(start, start + this.pageSize);
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
    this.page.set(1);
    void this.router.navigate([], { queryParams: { category, page: null }, replaceUrl: true });
  }

  /** Changes the page; from the pager it also scrolls back to the top of the products. */
  protected setPage(page: number, scroll: boolean): void {
    if (page === this.page()) return;
    this.page.set(page);
    void this.router.navigate([], { queryParams: { page: page > 1 ? page : null }, queryParamsHandling: 'merge', replaceUrl: !scroll });
    if (scroll) document.getElementById('products-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private initialPage(): number {
    const value = Number(this.route.snapshot.queryParamMap.get('page'));
    return Number.isInteger(value) && value > 1 ? value : 1;
  }

  protected maxFor(p: Product): number {
    return Math.min(MAX_PER_PRODUCT, p.stock);
  }

  private initialCategory(): ProductCategory | null {
    const value = this.route.snapshot.queryParamMap.get('category') as ProductCategory | null;
    return value && value in CATEGORY_INFO ? value : null;
  }
}
