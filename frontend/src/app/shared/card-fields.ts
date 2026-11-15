import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PaymentCard } from '../core/model';
import { TranslatePipe } from '../core/i18n';

export interface CardFormValue { holderName: string; number: string; expiry: string; cvc: string; }

export function emptyCard(): CardFormValue {
  return { holderName: '', number: '', expiry: '', cvc: '' };
}

/** Card number, expiry and CVC inputs with light formatting. The parent owns the value object. */
@Component({
  selector: 'app-card-fields',
  imports: [TranslatePipe, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (testMode()) {
      <p class="alert warn small-alert">
        {{ 'Test mode: no real money is taken. Use card 4242 4242 4242 4242, any future expiry date and any 3-digit CVC.' | t }}
      </p>
    }
    <div class="field">
      <label for="cf-name">{{ 'Name on card' | t }}</label>
      <input id="cf-name" name="ccname" autocomplete="cc-name" maxlength="100" [(ngModel)]="card().holderName" />
    </div>
    <div class="field">
      <label for="cf-number">{{ 'Card number' | t }}</label>
      <input id="cf-number" name="cardnumber" autocomplete="cc-number" inputmode="numeric" maxlength="23" placeholder="1234 5678 9012 3456"
        [ngModel]="card().number" (ngModelChange)="card().number = formatNumber($event)" />
    </div>
    <div class="form-grid">
      <div class="field">
        <label for="cf-exp">{{ 'Expiry (MM/YY)' | t }}</label>
        <input id="cf-exp" name="cc-exp" autocomplete="cc-exp" inputmode="numeric" maxlength="5" placeholder="MM/YY"
          [ngModel]="card().expiry" (ngModelChange)="card().expiry = formatExpiry($event)" />
      </div>
      <div class="field">
        <label for="cf-cvc">CVC</label>
        <input id="cf-cvc" name="cvc" autocomplete="cc-csc" inputmode="numeric" maxlength="4" placeholder="123" [(ngModel)]="card().cvc" />
      </div>
    </div>
  `
})
export class CardFields {
  readonly card = input.required<CardFormValue>();
  readonly testMode = input(true);

  protected formatNumber(value: string): string {
    return value.replace(/\D/g, '').slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ');
  }

  protected formatExpiry(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
  }
}

/** Checks the card before sending it; returns an error message, or the card ready for the API. */
export function readCard(value: CardFormValue): { error: string } | { card: PaymentCard } {
  if (!value.holderName.trim()) return { error: 'Enter the name on the card.' };
  const digits = value.number.replace(/\D/g, '');
  if (digits.length < 12 || !luhn(digits)) return { error: 'The card number is not valid.' };
  const match = /^(\d{2})\/(\d{2})$/.exec(value.expiry);
  if (!match) return { error: 'Enter the expiry date as MM/YY.' };
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  const now = new Date();
  if (month < 1 || month > 12) return { error: 'The expiry month is not valid.' };
  if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) return { error: 'The card has expired.' };
  if (!/^\d{3,4}$/.test(value.cvc.trim())) return { error: 'The CVC is the 3 or 4 digits on the back of the card.' };
  return { card: { holderName: value.holderName.trim(), number: digits, expiryMonth: month, expiryYear: year, cvc: value.cvc.trim() } };
}

function luhn(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}
