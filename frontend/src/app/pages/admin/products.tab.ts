import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { ProductImage } from '../../shared/product-image';
import { CATEGORY_INFO, StoreApi } from '../../core/store.api';
import { MedicalApi } from '../../core/medical.api';
import { Medication, Product, ProductCategory, ProductRequest } from '../../core/model';
import { apiErrorMessage } from '../../core/api-error';
import { I18n, TranslatePipe } from '../../core/i18n';
import { orNull } from '../../core/util';

@Component({
  selector: 'app-admin-products',
  imports: [TranslatePipe, FormsModule, CurrencyPipe, ProductImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toolbar">
      <div class="field grow"><label for="pr-search" class="sr-only">{{ 'Search' | t }}</label>
        <input id="pr-search" type="search" [placeholder]="'Search products' | t" [ngModel]="search()" (ngModelChange)="search.set($event)" /></div>
      <button class="btn primary small" type="button" (click)="edit(null)">{{ 'Add a product' | t }}</button>
    </div>

    @if (message()) { <p class="alert success" role="status">{{ message() }}</p> }
    @if (error()) { <p class="alert error" role="alert">{{ error() }}</p> }

    @if (form(); as f) {
      <form class="card form-card" (ngSubmit)="save()">
        <h3>{{ (editingId() ? 'Edit product' : 'New product') | t }}</h3>
        <div class="form-grid">
          <div class="field"><label for="pf-name">{{ 'Name' | t }}</label><input id="pf-name" name="name" maxlength="150" [(ngModel)]="f.name" /></div>
          <div class="field">
            <label for="pf-cat">{{ 'Category' | t }}</label>
            <select id="pf-cat" name="cat" [(ngModel)]="f.category">
              @for (c of categories; track c) { <option [value]="c">{{ info[c].icon }} {{ info[c].label }}</option> }
            </select>
          </div>
          <div class="field"><label for="pf-price">{{ 'Price (GEL)' | t }}</label><input id="pf-price" name="price" type="number" min="0.01" step="0.01" [(ngModel)]="f.price" /></div>
          <div class="field"><label for="pf-stock">{{ 'In stock' | t }}</label><input id="pf-stock" name="stock" type="number" min="0" [(ngModel)]="f.stock" /></div>
          <div class="field"><label for="pf-unit">{{ 'Pack size' | t }}</label><input id="pf-unit" name="unit" maxlength="50" [placeholder]="'20 tablets' | t" [(ngModel)]="f.unit" /></div>
        </div>
        <div class="field"><label for="pf-desc">{{ 'Description' | t }}</label><textarea id="pf-desc" name="desc" rows="2" maxlength="1000" [(ngModel)]="f.description"></textarea></div>

        @if (editing(); as p) {
          <fieldset class="fieldset">
            <legend>{{ 'Picture' | t }}</legend>
            <div class="product-photo-row">
              <app-product-image class="admin-pic" [attr.data-cat]="f.category"
                [name]="f.name || p.name" [category]="f.category" [imageUrl]="p.imageUrl" />
              <div>
                <p class="muted small">
                  {{ (p.imageUrl ? 'Showing the uploaded photo.' : 'Showing the built-in illustration. Upload a photo to replace it.') | t }}
                  {{ 'PNG, JPG or WebP, up to 3 MB. A square photo on a plain background looks best.' | t }}
                </p>
                <input #photoInput class="sr-only" id="pf-photo" type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" (change)="uploadPhoto(p, $event)" />
                <div class="card-actions tight">
                  <label class="btn small" for="pf-photo">{{ (p.imageUrl ? 'Replace photo' : 'Upload photo') | t }}</label>
                  @if (p.imageUrl) {
                    <button class="btn small danger" type="button" (click)="removePhoto(p)" [disabled]="busy()">{{ 'Use illustration' | t }}</button>
                  }
                </div>
              </div>
            </div>
          </fieldset>
        } @else {
          <p class="muted small">{{ 'You can add a photo after saving the product.' | t }}</p>
        }

        <label class="check"><input type="checkbox" name="rx" [(ngModel)]="f.requiresPrescription" /> {{ '℞ Prescription only' | t }}</label>
        @if (f.requiresPrescription) {
          <div class="field section-gap">
            <label for="pf-med">{{ 'Medication the prescription must contain' | t }}</label>
            <select id="pf-med" name="med" [(ngModel)]="f.medicationId">
              <option [ngValue]="null" disabled>{{ 'Choose' | t }}</option>
              @for (m of medications(); track m.id) { <option [ngValue]="m.id">{{ m.name }} {{ m.strength }} ({{ m.form }})</option> }
            </select>
          </div>
        }
        <label class="check"><input type="checkbox" name="active" [(ngModel)]="f.isActive" /> {{ 'Sold in the pharmacy' | t }}</label>

        <div class="card-actions">
          <button class="btn primary" type="submit" [disabled]="busy()">{{ 'Save' | t }}</button>
          <button class="btn" type="button" (click)="form.set(null)">{{ 'Cancel' | t }}</button>
        </div>
      </form>
    }

    <div class="table-wrap">
      <table class="table">
        <thead><tr><th></th><th>{{ 'Product' | t }}</th><th>{{ 'Category' | t }}</th><th class="right">{{ 'Price' | t }}</th><th class="right">{{ 'Stock' | t }}</th><th>℞</th><th>{{ 'Status' | t }}</th><th></th></tr></thead>
        <tbody>
          @for (p of visible(); track p.id) {
            <tr>
              <td><app-product-image class="table-thumb" [attr.data-cat]="p.category" [name]="p.name" [category]="p.category" [imageUrl]="p.imageUrl" /></td>
              <td>{{ p.name }} <span class="muted small">{{ p.unit }}</span>@if (p.imageUrl) { <span class="muted small"> · 📷</span> }</td>
              <td>{{ info[p.category].icon }} {{ info[p.category].label }}</td>
              <td class="right">{{ p.price | currency: 'GEL' : 'symbol-narrow' }}</td>
              <td class="right" [class.warn-text]="p.stock <= 5">{{ p.stock }}</td>
              <td>@if (p.requiresPrescription) { <span class="rx-mini" [title]="p.medicationName ?? ''">℞</span> }</td>
              <td><span class="badge" [class.ok]="p.isActive" [class.muted-badge]="!p.isActive">{{ (p.isActive ? 'On sale' : 'Hidden') | t }}</span></td>
              <td class="right"><button class="btn small" type="button" (click)="edit(p)">{{ 'Edit' | t }}</button></td>
            </tr>
          } @empty {
            <tr><td colspan="8" class="muted">{{ 'No products.' | t }}</td></tr>
          }
        </tbody>
      </table>
    </div>
  `
})
export class AdminProductsTab {
  protected readonly i18n = inject(I18n);
  private readonly api = inject(StoreApi);
  private readonly medical = inject(MedicalApi);

  protected readonly info = CATEGORY_INFO;
  protected readonly categories = Object.keys(CATEGORY_INFO) as ProductCategory[];
  protected readonly products = signal<Product[]>([]);
  protected readonly medications = signal<Medication[]>([]);
  protected readonly search = signal('');
  protected readonly form = signal<ProductRequest | null>(null);
  protected readonly editingId = signal<number | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly message = signal<string | null>(null);

  /** The saved product being edited (photos can only be added once the product exists). */
  protected readonly editing = computed(() => this.products().find(p => p.id === this.editingId()) ?? null);
  private readonly photoInput = viewChild<ElementRef<HTMLInputElement>>('photoInput');

  protected uploadPhoto(p: Product, event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      this.error.set(this.i18n.t('The picture must be 3 MB or smaller.'));
      return;
    }
    this.photoRequest(this.api.uploadProductImage(p.id, file), 'The photo was saved.');
  }

  protected removePhoto(p: Product): void {
    this.photoRequest(this.api.deleteProductImage(p.id), 'The photo was removed; the illustration is shown again.');
  }

  private photoRequest(request: Observable<Product>, success: string): void {
    this.busy.set(true);
    this.error.set(null);
    this.message.set(null);
    request.subscribe({
      next: updated => {
        this.busy.set(false);
        this.products.set(this.products().map(x => x.id === updated.id ? updated : x));
        this.message.set(success);
        const input = this.photoInput()?.nativeElement;
        if (input) input.value = '';
      },
      error: err => {
        this.busy.set(false);
        this.error.set(apiErrorMessage(err));
      }
    });
  }

  protected readonly visible = computed(() => {
    const term = this.search().trim().toLowerCase();
    return this.products().filter(p => !term || p.name.toLowerCase().includes(term));
  });

  constructor() {
    this.load();
    this.medical.medications(null).subscribe({ next: list => this.medications.set(list) });
  }

  protected edit(p: Product | null): void {
    this.message.set(null);
    this.error.set(null);
    this.editingId.set(p?.id ?? null);
    this.form.set(p
      ? { name: p.name, description: p.description, unit: p.unit, category: p.category, price: p.price, stock: p.stock,
          isActive: p.isActive, requiresPrescription: p.requiresPrescription, medicationId: p.medicationId }
      : { name: '', description: '', unit: '', category: 'Medicines', price: 5, stock: 20, isActive: true, requiresPrescription: false, medicationId: null });
  }

  protected save(): void {
    const f = this.form();
    if (!f) return;
    if (!f.name.trim()) {
      this.error.set(this.i18n.t('Enter a name.'));
      return;
    }
    if (f.requiresPrescription && !f.medicationId) {
      this.error.set(this.i18n.t('Choose the medication a prescription must contain.'));
      return;
    }
    const request: ProductRequest = {
      ...f, name: f.name.trim(), description: orNull(f.description), unit: orNull(f.unit),
      price: Number(f.price), stock: Number(f.stock), medicationId: f.requiresPrescription ? f.medicationId : null
    };
    const id = this.editingId();
    this.busy.set(true);
    this.error.set(null);
    (id ? this.api.updateProduct(id, request) : this.api.createProduct(request)).subscribe({
      next: () => {
        this.busy.set(false);
        this.form.set(null);
        this.message.set(this.i18n.t('The product was saved.'));
        this.load();
      },
      error: err => {
        this.busy.set(false);
        this.error.set(apiErrorMessage(err));
      }
    });
  }

  private load(): void {
    this.api.products(null, null, true).subscribe({
      next: list => this.products.set(list),
      error: err => this.error.set(apiErrorMessage(err))
    });
  }
}
