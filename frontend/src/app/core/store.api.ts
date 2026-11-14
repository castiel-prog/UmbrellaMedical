import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ApprovePrescriptionRequestBody, CreatePrescriptionRequestBody, CreateStoreOrder, PagedResult, Prescription,
  PrescriptionRequestItem, PrescriptionRequestStatus, Product, ProductCategory, ProductRequest, StoreOrder,
  StoreOrderStatus, UsablePrescription
} from './model';
import { queryParams } from './util';

/** The clinic store, store orders, prescription requests and prescription history. */
@Injectable({ providedIn: 'root' })
export class StoreApi {
  private readonly http = inject(HttpClient);

  // Products
  products(category: ProductCategory | null = null, search: string | null = null, includeInactive = false): Observable<Product[]> {
    return this.http.get<Product[]>('/api/store/products', { params: queryParams({ category, search, includeInactive: includeInactive || null }) });
  }
  createProduct(r: ProductRequest): Observable<Product> {
    return this.http.post<Product>('/api/store/products', r);
  }
  updateProduct(id: number, r: ProductRequest): Observable<Product> {
    return this.http.put<Product>(`/api/store/products/${id}`, r);
  }
  myPrescriptionsFor(productId: number): Observable<UsablePrescription[]> {
    return this.http.get<UsablePrescription[]>(`/api/store/products/${productId}/my-prescriptions`);
  }

  // Orders
  placeOrder(order: CreateStoreOrder): Observable<StoreOrder> {
    return this.http.post<StoreOrder>('/api/store/orders', order);
  }
  orders(query: { status?: StoreOrderStatus | null; search?: string | null; page?: number; pageSize?: number }): Observable<PagedResult<StoreOrder>> {
    return this.http.get<PagedResult<StoreOrder>>('/api/store/orders', { params: queryParams({ ...query }) });
  }
  approveOrder(id: number, note: string | null): Observable<StoreOrder> {
    return this.http.post<StoreOrder>(`/api/store/orders/${id}/approve`, { note });
  }
  rejectOrder(id: number, reason: string): Observable<StoreOrder> {
    return this.http.post<StoreOrder>(`/api/store/orders/${id}/reject`, { reason });
  }
  completeOrder(id: number): Observable<StoreOrder> {
    return this.http.post<StoreOrder>(`/api/store/orders/${id}/complete`, {});
  }
  cancelOrder(id: number): Observable<StoreOrder> {
    return this.http.post<StoreOrder>(`/api/store/orders/${id}/cancel`, {});
  }
  orderPrescriptionFile(id: number): Observable<HttpResponse<Blob>> {
    return this.http.get(`/api/store/orders/${id}/prescription-file`, { responseType: 'blob', observe: 'response' });
  }

  // Prescription requests
  requests(status: PrescriptionRequestStatus | null = null, page = 1, pageSize = 20): Observable<PagedResult<PrescriptionRequestItem>> {
    return this.http.get<PagedResult<PrescriptionRequestItem>>('/api/prescription-requests', { params: queryParams({ status, page, pageSize }) });
  }
  requestPrescription(body: CreatePrescriptionRequestBody): Observable<PrescriptionRequestItem> {
    return this.http.post<PrescriptionRequestItem>('/api/prescription-requests', body);
  }
  approveRequest(id: number, body: ApprovePrescriptionRequestBody): Observable<PrescriptionRequestItem> {
    return this.http.post<PrescriptionRequestItem>(`/api/prescription-requests/${id}/approve`, body);
  }
  declineRequest(id: number, reason: string): Observable<PrescriptionRequestItem> {
    return this.http.post<PrescriptionRequestItem>(`/api/prescription-requests/${id}/decline`, { reason });
  }
  withdrawRequest(id: number): Observable<void> {
    return this.http.delete<void>(`/api/prescription-requests/${id}`);
  }

  // Prescription history (staff)
  prescriptions(search: string | null, activeOnly: boolean | null, page = 1, pageSize = 20): Observable<PagedResult<Prescription>> {
    return this.http.get<PagedResult<Prescription>>('/api/prescriptions', { params: queryParams({ search, activeOnly, page, pageSize }) });
  }
}

export const CATEGORY_INFO: Record<ProductCategory, { label: string; icon: string }> = {
  Medicines: { label: 'Medicines', icon: '💊' },
  Vitamins: { label: 'Vitamins', icon: '🍊' },
  PersonalCare: { label: 'Personal care', icon: '🧴' },
  Hygiene: { label: 'Hygiene', icon: '🧼' },
  FirstAid: { label: 'First aid', icon: '🩹' },
  Devices: { label: 'Health devices', icon: '🌡️' }
};
