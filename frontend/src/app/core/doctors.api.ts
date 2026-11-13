import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DoctorListItem, PagedResult, Specialization } from './model';

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

  specializations(): Observable<Specialization[]> {
    return this.http.get<Specialization[]>('/api/specializations');
  }
}