import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { StaffApi } from '../core/staff.api';
import { ProfileService } from '../core/profile.service';
import { DoctorDetails, Education, Experience } from '../core/model';
import { apiErrorMessage } from '../core/api-error';
import { orNull } from '../core/util';
import { Certificate } from './certificate';

interface ExperienceRow { workplace: string; position: string; startDate: string; endDate: string; description: string; }

/** Lets a doctor edit what patients see on their public profile. */
@Component({
  selector: 'app-doctor-profile-editor',
  imports: [FormsModule, RouterLink, Certificate],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (error()) { <p class="alert error" role="alert">{{ error() }}</p> }
    @if (message()) { <p class="alert success" role="status">{{ message() }}</p> }

    @if (doctor(); as d) {
      <p class="muted">
        Patients see this on <a [routerLink]="['/doctors', d.id]">your public profile</a>.
        Your name, specialization and licence number are managed by the clinic.
      </p>

      <form (ngSubmit)="save()">
        <div class="field">
          <label for="dp-bio">About you</label>
          <textarea id="dp-bio" name="bio" rows="4" maxlength="2000" [(ngModel)]="bio"
            placeholder="Your approach to care, what you focus on, languages you speak..."></textarea>
          <small class="muted right">{{ bio.length }} / 2000</small>
        </div>
        <div class="form-grid">
          <div class="field"><label for="dp-phone">Work phone (not shown publicly)</label><input id="dp-phone" name="phone" type="tel" maxlength="30" [(ngModel)]="phone" /></div>
          <div class="field"><label for="dp-years">Years of experience</label><input id="dp-years" name="years" type="number" min="0" max="60" [(ngModel)]="years" /></div>
        </div>

        <fieldset class="fieldset">
          <legend>Education</legend>
          @for (e of educations(); track $index; let i = $index) {
            <div class="edu-row">
              <div class="field"><label [for]="'ed-d' + i">Degree</label><input [id]="'ed-d' + i" [name]="'edd' + i" maxlength="200" placeholder="MD, Cardiology" [(ngModel)]="e.degree" /></div>
              <div class="field"><label [for]="'ed-i' + i">Institution</label><input [id]="'ed-i' + i" [name]="'edi' + i" maxlength="200" [(ngModel)]="e.institution" /></div>
              <div class="field"><label [for]="'ed-s' + i">From</label><input [id]="'ed-s' + i" [name]="'eds' + i" type="number" min="1950" max="2100" [(ngModel)]="e.startYear" /></div>
              <div class="field"><label [for]="'ed-g' + i">Graduated</label><input [id]="'ed-g' + i" [name]="'edg' + i" type="number" min="1950" max="2100" [(ngModel)]="e.graduationYear" /></div>
              <button class="btn small danger" type="button" aria-label="Remove education" (click)="educations.set(without(educations(), i))">✕</button>
            </div>
          }
          <button class="btn small" type="button" (click)="addEducation()">Add education</button>
        </fieldset>

        <fieldset class="fieldset">
          <legend>Experience</legend>
          @for (x of experiences(); track $index; let i = $index) {
            <div class="exp-block">
              <div class="form-grid">
                <div class="field"><label [for]="'ex-p' + i">Position</label><input [id]="'ex-p' + i" [name]="'exp' + i" maxlength="200" [(ngModel)]="x.position" /></div>
                <div class="field"><label [for]="'ex-w' + i">Workplace</label><input [id]="'ex-w' + i" [name]="'exw' + i" maxlength="200" [(ngModel)]="x.workplace" /></div>
                <div class="field"><label [for]="'ex-s' + i">Started</label><input [id]="'ex-s' + i" [name]="'exs' + i" type="date" [(ngModel)]="x.startDate" /></div>
                <div class="field"><label [for]="'ex-e' + i">Ended (empty = still there)</label><input [id]="'ex-e' + i" [name]="'exe' + i" type="date" [(ngModel)]="x.endDate" /></div>
              </div>
              <div class="field"><label [for]="'ex-d' + i">Description</label><input [id]="'ex-d' + i" [name]="'exd' + i" maxlength="1000" [(ngModel)]="x.description" /></div>
              <button class="btn small danger" type="button" (click)="experiences.set(without(experiences(), i))">Remove this job</button>
            </div>
          }
          <button class="btn small" type="button" (click)="addExperience()">Add experience</button>
        </fieldset>

        <button class="btn primary" type="submit" [disabled]="busy()">{{ busy() ? 'Saving...' : 'Save profile' }}</button>
      </form>

      <h2>Your certificates</h2>
      <p class="muted">Shown on your public profile. A degree certificate is created for each education you list.</p>
      <div class="certificates">
        <app-certificate kind="excellence" [doctor]="d" />
        @for (e of d.educations; track $index) {
          <app-certificate kind="degree" [doctor]="d" [education]="e" />
        }
      </div>
    } @else if (!error()) {
      <p class="muted">Loading...</p>
    }
  `
})
export class DoctorProfileEditor {
  private readonly staff = inject(StaffApi);
  private readonly profile = inject(ProfileService);

  protected readonly doctor = signal<DoctorDetails | null>(null);
  protected readonly educations = signal<Education[]>([]);
  protected readonly experiences = signal<ExperienceRow[]>([]);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly message = signal<string | null>(null);
  protected bio = '';
  protected phone = '';
  protected years = 0;

  constructor() {
    this.load();
  }

  protected without<T>(list: T[], index: number): T[] {
    return list.filter((_, i) => i !== index);
  }

  protected addEducation(): void {
    const year = new Date().getFullYear();
    this.educations.set([...this.educations(), { degree: '', institution: '', startYear: year - 6, graduationYear: year }]);
  }

  protected addExperience(): void {
    this.experiences.set([...this.experiences(), { workplace: '', position: '', startDate: '', endDate: '', description: '' }]);
  }

  protected save(): void {
    const educations = this.educations();
    const experiences = this.experiences();

    if (educations.some(e => !e.degree.trim() || !e.institution.trim() || !e.startYear || !e.graduationYear)) {
      this.error.set('Fill in degree, institution and years for each education, or remove the empty row.');
      return;
    }
    if (educations.some(e => Number(e.startYear) > Number(e.graduationYear))) {
      this.error.set('Each education must start before the graduation year.');
      return;
    }
    if (experiences.some(x => !x.workplace.trim() || !x.position.trim() || !x.startDate)) {
      this.error.set('Fill in position, workplace and start date for each job, or remove the empty one.');
      return;
    }
    if (experiences.some(x => x.endDate && x.endDate < x.startDate)) {
      this.error.set('Each job must start before it ends.');
      return;
    }

    this.busy.set(true);
    this.error.set(null);
    this.message.set(null);
    this.profile.updateDoctorProfile({
      bio: orNull(this.bio),
      phone: orNull(this.phone),
      yearsOfExperience: Number(this.years) || 0,
      educations: educations.map(e => ({
        degree: e.degree.trim(), institution: e.institution.trim(),
        startYear: Number(e.startYear), graduationYear: Number(e.graduationYear)
      })),
      experiences: experiences.map<Experience>(x => ({
        workplace: x.workplace.trim(), position: x.position.trim(),
        startDate: x.startDate, endDate: x.endDate || null, description: orNull(x.description)
      }))
    }).subscribe({
      next: () => {
        this.busy.set(false);
        this.message.set('Your profile was saved.');
        this.load();
      },
      error: err => {
        this.busy.set(false);
        this.error.set(apiErrorMessage(err));
      }
    });
  }

  private load(): void {
    this.staff.myDoctorProfile().subscribe({
      next: d => {
        this.doctor.set(d);
        this.bio = d.bio ?? '';
        this.phone = d.phone ?? '';
        this.years = d.yearsOfExperience;
        this.educations.set(d.educations.map(e => ({ ...e })));
        this.experiences.set(d.experiences.map(x => ({
          workplace: x.workplace, position: x.position, startDate: x.startDate,
          endDate: x.endDate ?? '', description: x.description ?? ''
        })));
      },
      error: err => this.error.set(apiErrorMessage(err))
    });
  }
}
