import { Injectable, computed, signal } from '@angular/core';
import { Product } from './model';

export interface CartLine {
  product: Product;
  quantity: number;
}

const STORAGE_KEY = 'umbrella.cart';
export const MAX_PER_PRODUCT = 20;

/** The store cart, kept in this browser between visits. */
@Injectable({ providedIn: 'root' })
export class CartService {
  readonly lines = signal<CartLine[]>(this.restore());
  readonly count = computed(() => this.lines().reduce((sum, l) => sum + l.quantity, 0));
  readonly total = computed(() => Math.round(this.lines().reduce((sum, l) => sum + l.product.price * l.quantity, 0) * 100) / 100);
  readonly needsPrescription = computed(() => this.lines().some(l => l.product.requiresPrescription));

  quantityOf(productId: number): number {
    return this.lines().find(l => l.product.id === productId)?.quantity ?? 0;
  }

  add(product: Product, quantity = 1): void {
    const limit = Math.min(MAX_PER_PRODUCT, product.stock);
    const existing = this.lines().find(l => l.product.id === product.id);
    if (existing) {
      this.setQuantity(product.id, Math.min(limit, existing.quantity + quantity));
    } else if (limit > 0) {
      this.update([...this.lines(), { product, quantity: Math.min(limit, quantity) }]);
    }
  }

  setQuantity(productId: number, quantity: number): void {
    if (quantity <= 0) {
      this.remove(productId);
      return;
    }
    this.update(this.lines().map(l => l.product.id === productId
      ? { ...l, quantity: Math.min(quantity, MAX_PER_PRODUCT, l.product.stock) }
      : l));
  }

  remove(productId: number): void {
    this.update(this.lines().filter(l => l.product.id !== productId));
  }

  clear(): void {
    this.update([]);
  }

  /** Refreshes prices and stock from the latest product list; drops products no longer sold. */
  sync(products: Product[]): void {
    const byId = new Map(products.map(p => [p.id, p]));
    this.update(this.lines()
      .filter(l => byId.has(l.product.id) && byId.get(l.product.id)!.stock > 0)
      .map(l => {
        const product = byId.get(l.product.id)!;
        return { product, quantity: Math.min(l.quantity, product.stock, MAX_PER_PRODUCT) };
      }));
  }

  private update(lines: CartLine[]): void {
    this.lines.set(lines);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch { /* storage may be unavailable */ }
  }

  private restore(): CartLine[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as CartLine[]) : [];
      return parsed.filter(l => l?.product?.id && l.quantity > 0);
    } catch {
      return [];
    }
  }
}
