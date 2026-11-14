import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  CreateInvoiceRequest, InsuranceCompany, Invoice, InvoiceListItem, InvoiceStatus, PagedResult,
  Payment, PaymentMethod, PaymentStatus, Receipt
} from './model';
import { queryParams } from './util';

export interface InvoiceQuery {
  patientId?: number | null;
  status?: InvoiceStatus | null;
  search?: string | null;
  from?: string | null;
  to?: string | null;
  page?: number;
  pageSize?: number;
}

export interface PaymentQuery {
  invoiceId?: number | null;
  patientId?: number | null;
  method?: PaymentMethod | null;
  status?: PaymentStatus | null;
  from?: string | null;
  to?: string | null;
  page?: number;
  pageSize?: number;
}

@Injectable({ providedIn: 'root' })
export class BillingApi {
  private readonly http = inject(HttpClient);

  invoices(query: InvoiceQuery): Observable<PagedResult<InvoiceListItem>> {
    return this.http.get<PagedResult<InvoiceListItem>>('/api/invoices', { params: queryParams({ ...query }) });
  }

  invoice(id: number): Observable<Invoice> {
    return this.http.get<Invoice>(`/api/invoices/${id}`);
  }

  createInvoice(request: CreateInvoiceRequest): Observable<Invoice> {
    return this.http.post<Invoice>('/api/invoices', request);
  }

  addPayment(invoiceId: number, amount: number, method: PaymentMethod, reference: string | null): Observable<Payment> {
    return this.http.post<Payment>(`/api/invoices/${invoiceId}/payments`, { amount, method, reference });
  }

  cancelInvoice(id: number, reason: string): Observable<Invoice> {
    return this.http.post<Invoice>(`/api/invoices/${id}/cancel`, { reason });
  }

  payments(query: PaymentQuery): Observable<PagedResult<Payment>> {
    return this.http.get<PagedResult<Payment>>('/api/payments', { params: queryParams({ ...query }) });
  }

  receipt(paymentId: number): Observable<Receipt> {
    return this.http.get<Receipt>(`/api/payments/${paymentId}/receipt`);
  }

  refund(paymentId: number, reason: string): Observable<Payment> {
    return this.http.post<Payment>(`/api/payments/${paymentId}/refund`, { reason });
  }

  insuranceCompanies(): Observable<InsuranceCompany[]> {
    return this.http.get<InsuranceCompany[]>('/api/insurance-companies');
  }

  createInsuranceCompany(request: Omit<InsuranceCompany, 'id'>): Observable<InsuranceCompany> {
    return this.http.post<InsuranceCompany>('/api/insurance-companies', request);
  }

  updateInsuranceCompany(id: number, request: Omit<InsuranceCompany, 'id'>): Observable<InsuranceCompany> {
    return this.http.put<InsuranceCompany>(`/api/insurance-companies/${id}`, request);
  }
}
