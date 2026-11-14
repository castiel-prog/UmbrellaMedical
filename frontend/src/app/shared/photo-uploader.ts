import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { ProfileService } from '../core/profile.service';
import { apiErrorMessage } from '../core/api-error';
import { Avatar } from './avatar';

const MAX_BYTES = 2 * 1024 * 1024;

@Component({
  selector: 'app-photo-uploader',
  imports: [Avatar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="photo-uploader">
      @if (preview(); as p) {
        <img class="avatar big" [src]="p" alt="Preview of your new picture" />
      } @else {
        <app-avatar size="big" [url]="profile.me()?.photoUrl ?? null" [name]="profile.me()?.displayName ?? profile.me()?.email ?? ''" />
      }

      <div class="photo-actions">
        <p class="muted small">PNG or JPG, up to 2 MB. A square picture looks best.</p>
        <input #fileInput class="sr-only" id="photo-file" type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" (change)="pick($event)" />
        <div class="card-actions tight">
          @if (preview()) {
            <button class="btn primary small" type="button" (click)="upload()" [disabled]="busy()">{{ busy() ? 'Uploading...' : 'Save picture' }}</button>
            <button class="btn small" type="button" (click)="clear()" [disabled]="busy()">Cancel</button>
          } @else {
            <label class="btn small" for="photo-file">{{ profile.me()?.photoUrl ? 'Change picture' : 'Upload a picture' }}</label>
            @if (profile.me()?.photoUrl) {
              <button class="btn small danger" type="button" (click)="remove()" [disabled]="busy()">Remove</button>
            }
          }
        </div>
        @if (message()) { <p class="field-ok">{{ message() }}</p> }
        @if (error()) { <p class="field-error" role="alert">{{ error() }}</p> }
      </div>
    </div>
  `
})
export class PhotoUploader {
  protected readonly profile = inject(ProfileService);
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  protected readonly preview = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly message = signal<string | null>(null);
  private file: File | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.revokePreview());
  }

  protected pick(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    this.error.set(null);
    this.message.set(null);
    if (!file) return;

    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      this.error.set('Use a PNG or JPG picture.');
      this.resetInput();
      return;
    }
    if (file.size > MAX_BYTES) {
      this.error.set('The picture must be 2 MB or smaller.');
      this.resetInput();
      return;
    }

    this.revokePreview();
    this.file = file;
    this.preview.set(URL.createObjectURL(file));
  }

  protected upload(): void {
    if (!this.file) return;
    this.busy.set(true);
    this.error.set(null);
    this.profile.uploadPhoto(this.file).subscribe({
      next: () => {
        this.busy.set(false);
        this.clear();
        this.message.set('Your picture was updated.');
      },
      error: err => {
        this.busy.set(false);
        this.error.set(apiErrorMessage(err));
      }
    });
  }

  protected remove(): void {
    this.busy.set(true);
    this.error.set(null);
    this.message.set(null);
    this.profile.deletePhoto().subscribe({
      next: () => {
        this.busy.set(false);
        this.message.set('Your picture was removed.');
      },
      error: err => {
        this.busy.set(false);
        this.error.set(apiErrorMessage(err));
      }
    });
  }

  protected clear(): void {
    this.revokePreview();
    this.file = null;
    this.resetInput();
  }

  private revokePreview(): void {
    const current = this.preview();
    if (current) URL.revokeObjectURL(current);
    this.preview.set(null);
  }

  private resetInput(): void {
    const input = this.fileInput()?.nativeElement;
    if (input) input.value = '';
  }
}
