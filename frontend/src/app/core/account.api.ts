import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AccountInfo, MessageResponse } from './model';

@Injectable({ providedIn: 'root' })
export class AccountApi {
  private readonly http = inject(HttpClient);

  get(): Observable<AccountInfo> {
    return this.http.get<AccountInfo>('/api/account');
  }

  sendVerification(): Observable<MessageResponse> {
    return this.http.post<MessageResponse>('/api/account/email/send-verification', {});
  }

  verifyEmail(code: string): Observable<AccountInfo> {
    return this.http.post<AccountInfo>('/api/account/email/verify', { code });
  }
}