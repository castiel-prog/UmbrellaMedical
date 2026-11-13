import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DoctorListItem } from './model';
import { StarRating } from './star-rating';

@Component({
  selector: 'app-doctor-card',
  imports: [StarRating],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="card doctor">
      @if (doctor().photoUrl; as photo) {
        <img class="avatar" [src]="photo" alt="" />
      } @else {
        <div class="avatar" aria-hidden="true">{{ initials() }}</div>
      }
      <div class="doctor-info">
        <h3>Dr. {{ doctor().firstName }} {{ doctor().lastName }}</h3>
        <p class="spec">{{ doctor().specialization }}</p>
        <p class="muted">{{ doctor().yearsOfExperience }} years of experience</p>
        @if (doctor().reviewCount > 0) {
          <app-star-rating [value]="doctor().averageRating" [count]="doctor().reviewCount" />
        } @else {
          <span class="muted">No reviews yet</span>
        }
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