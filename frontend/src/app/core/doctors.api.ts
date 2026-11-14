import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DoctorDetails, DoctorListItem, DoctorReviews, PagedResult, SlotsResponse, Specialization } from './model';

export interface DoctorQuery {
  search?: string;
  specializationId?: number | null;
  page?: number;
  pageSize?: number;
}

@Injectable({ providedIn: 'root' })
export class DoctorsApi {
  private readonly http = inject(HttpClient);

  list(query: DoctorQuery): Observable<PagedResult<DoctorListItem>> {
    let params = new HttpParams()
      .set('page', query.page ?? 1)
      .set('pageSize', query.pageSize ?? 12);

    if (query.search) params = params.set('search', query.search);
    if (query.specializationId) params = params.set('specializationId', query.specializationId);

    return this.http.get<PagedResult<DoctorListItem>>('/api/doctors', { params });
  }

  get(id: number): Observable<DoctorDetails> {
    return this.http.get<DoctorDetails>(`/api/doctors/${id}`);
  }

  reviews(id: number, page = 1, pageSize = 5): Observable<DoctorReviews> {
    const params = new HttpParams().set('page', page).set('pageSize', pageSize);
    return this.http.get<DoctorReviews>(`/api/doctors/${id}/reviews`, { params });
  }

  slots(doctorId: number, date: string, serviceId: number): Observable<SlotsResponse> {
    const params = new HttpParams().set('date', date).set('serviceId', serviceId);
    return this.http.get<SlotsResponse>(`/api/doctors/${doctorId}/slots`, { params });
  }

  specializations(): Observable<Specialization[]> {
    return this.http.get<Specialization[]>('/api/specializations');
  }
}