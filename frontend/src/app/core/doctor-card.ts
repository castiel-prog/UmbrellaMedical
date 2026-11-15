import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DoctorListItem } from './model';
import { StarRating } from './star-rating';
import { TranslatePipe } from './i18n';

@Component({
  selector: 'app-doctor-card',
  imports: [TranslatePipe, StarRating, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="card doctor">
      @if (doctor().photoUrl; as photo) {
        <img class="avatar" [src]="photo" alt="" />
      } @else {
        <div class="avatar" aria-hidden="true">{{ initials() }}</div>
      }
      <div class="doctor-info">
        <h3><a class="plain" [routerLink]="['/doctors', doctor().id]">{{ 'Dr. {name}' | t: { name: doctor().firstName + ' ' + doctor().lastName } }}</a></h3>
        <p class="spec">{{ doctor().specialization | t }}</p>
        <p class="muted">{{ '{n} years of experience' | t: { n: doctor().yearsOfExperience } }}</p>
        @if (doctor().reviewCount > 0) {
          <app-star-rating [value]="doctor().averageRating" [count]="doctor().reviewCount" />
        } @else {
          <span class="muted">{{ 'No reviews yet' | t }}</span>
        }
        <div class="card-actions">
          <a class="btn small" [routerLink]="['/doctors', doctor().id]">{{ 'Profile' | t }}</a>
          <a class="btn primary small" [routerLink]="['/book', doctor().id]">{{ 'Book a visit' | t }}</a>
        </div>
      </div>
    </article>
  `
})
export class DoctorCard {
  readonly doctor = input.required<DoctorListItem>();

  protected readonly initials = computed(() => {
    const d = this.doctor();
    return `${d.firstName.charAt(0)}${d.lastName.charAt(0)}`.toUpperCase();
  });
}