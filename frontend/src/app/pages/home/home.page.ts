import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { DoctorsApi } from '../../core/doctors.api';
import { DoctorListItem } from '../../core/model';
import { apiErrorMessage } from '../../core/api-error';
import { DoctorCard } from '../../core/doctor-card';
import { Logo } from '../../shared/logo';

@Component({
  selector: 'app-home',
  imports: [RouterLink, DoctorCard, Logo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="hero">
      <div class="hero-text">
        <h1>Care you can book in a minute</h1>
        <p>Find a doctor, pick a free time, and keep your visits, records and bills in one place.</p>
        <div class="hero-actions">
          <a class="btn primary" routerLink="/doctors">Find a doctor</a>
          @if (!auth.isLoggedIn()) {
            <a class="btn outline" routerLink="/register">Create an account</a>
          }
        </div>
      </div>
      <app-logo class="hero-logo" [size]="150" />
    </section>

    <section>
      <h2>Our doctors</h2>

      @if (loading()) {
        <p class="muted">Loading doctors...</p>
      } @else if (error()) {
        <p class="alert error" role="alert">{{ error() }}</p>
      } @else if (doctors().length === 0) {
        <p class="muted">No doctors are listed yet.</p>
      } @else {
        <div class="grid">
          @for (doctor of doctors(); track doctor.id) {
            <app-doctor-card [doctor]="doctor" />
          }
        </div>
        <p class="more"><a routerLink="/doctors">See all doctors</a></p>
      }
    </section>
  `
})
export class HomePage {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(DoctorsApi);

  protected readonly doctors = signal<DoctorListItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.api.list({ pageSize: 6 }).subscribe({
      next: result => {
        this.doctors.set(result.items);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(apiErrorMessage(err));
        this.loading.set(false);
      }
    });
  }
}