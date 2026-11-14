import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Appointment, AppointmentStatus, BookingQuote, CreateAppointmentRequest, PagedResult, Review } from './model';

export interface AppointmentQuery {
  status?: AppointmentStatus | null;
  from?: string | null;
  to?: string | null;
  doctorId?: number | null;
  patientId?: number | null;
  page?: number;
  pageSize?: number;
}

@Injectable({ providedIn: 'root' })
export class AppointmentsApi {
  private readonly http = inject(HttpClient);

  list(query: AppointmentQuery): Observable<PagedResult<Appointment>> {
    let params = new HttpParams()
      .set('page', query.page ?? 1)
      .set('pageSize', query.pageSize ?? 20);

    if (query.status) params = params.set('status', query.status);
    if (query.from) params = params.set('from', query.from);
    if (query.to) params = params.set('to', query.to);
    if (query.doctorId) params = params.set('doctorId', query.doctorId);
    if (query.patientId) params = params.set('patientId', query.patientId);

    return this.http.get<PagedResult<Appointment>>('/api/appointments', { params });
  }

  get(id: number): Observable<Appointment> {
    return this.http.get<Appointment>(`/api/appointments/${id}`);
  }

  quote(serviceId: number, startDateTime: string, patientId: number | null = null): Observable<BookingQuote> {
    let params = new HttpParams().set('serviceId', serviceId).set('startDateTime', startDateTime);
    if (patientId) params = params.set('patientId', patientId);
    return this.http.get<BookingQuote>('/api/appointments/quote', { params });
  }

  book(request: CreateAppointmentRequest): Observable<Appointment> {
    return this.http.post<Appointment>('/api/appointments', request);
  }

  reschedule(id: number, startDateTime: string): Observable<Appointment> {
    return this.http.put<Appointment>(`/api/appointments/${id}`, { startDateTime });
  }

  cancel(id: number, reason: string | null): Observable<void> {
    let params = new HttpParams();
    if (reason) params = params.set('reason', reason);
    return this.http.delete<void>(`/api/appointments/${id}`, { params });
  }

  complete(id: number, notes: string | null): Observable<Appointment> {
    return this.http.post<Appointment>(`/api/appointments/${id}/complete`, { notes });
  }

  noShow(id: number): Observable<Appointment> {
    return this.http.post<Appointment>(`/api/appointments/${id}/no-show`, {});
  }

  review(doctorId: number, appointmentId: number, rating: number, comment: string | null): Observable<Review> {
    return this.http.post<Review>(`/api/doctors/${doctorId}/reviews`, { appointmentId, rating, comment });
  }
}