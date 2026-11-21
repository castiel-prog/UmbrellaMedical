import { ChangeDetectionStrategy, Component, ElementRef, computed, forwardRef, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Icon } from './icon';
import { dateFormatter, I18n, TranslatePipe } from '../core/i18n';

type View = 'days' | 'months' | 'years';
interface Ymd { y: number; m: number; d: number; } // m is 1-12
interface DayCell { key: string; day: number; inMonth: boolean; disabled: boolean; today: boolean; selected: boolean; }

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function pad(n: number): string { return n < 10 ? '0' + n : '' + n; }
function keyOf(v: Ymd): string { return `${v.y}-${pad(v.m)}-${pad(v.d)}`; }
function parse(value: string | null | undefined): Ymd | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
}
function daysIn(y: number, m: number): number { return new Date(y, m, 0).getDate(); }
function fromDate(d: Date): Ymd { return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() }; }
function shift(v: Ymd, days: number): Ymd { return fromDate(new Date(v.y, v.m - 1, v.d + days)); }
function addMonths(v: Ymd, months: number): Ymd {
  const first = new Date(v.y, v.m - 1 + months, 1);
  const y = first.getFullYear(), m = first.getMonth() + 1;
  return { y, m, d: Math.min(v.d, daysIn(y, m)) };
}

/**
 * Styled date picker for reactive and template forms (value: "YYYY-MM-DD", like <input type="date">).
 * Calendar with quick month/year views, min/max limits and full keyboard support:
 * arrows move a day/week, PageUp/PageDown a month, Home/End the week, Enter picks, Escape closes.
 */
@Component({
  selector: 'app-date-picker',
  imports: [Icon, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DatePicker), multi: true }],
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '[class.invalid]': 'invalid()'
  },
  template: `
    <button type="button" class="dp-trigger" [id]="inputId()" [class.open]="open()" [class.empty]="!value()" [disabled]="disabled()"
      aria-haspopup="dialog" [attr.aria-expanded]="open()" [attr.aria-invalid]="invalid() || null"
      [attr.aria-describedby]="describedBy() || null" (click)="toggle()" (keydown)="onTriggerKey($event)">
      <span class="dp-icon"><app-icon name="calendar" [size]="18" /></span>
      <span class="dp-label">{{ label() }}</span>
      @if (age() !== null) { <span class="dp-age">{{ '{n} yrs' | t: { n: age() } }}</span> }
      <app-icon class="dp-chevron" name="chevron" [size]="18" />
    </button>

    @if (open()) {
      <div class="dp-panel" role="dialog" [attr.aria-label]="'Choose a date' | t" (keydown)="onPanelKey($event)">
        <div class="dp-head">
          <button type="button" class="dp-nav" (click)="step(-1)" [disabled]="!canStep(-1)" [attr.aria-label]="(view() === 'years' ? 'Earlier years' : 'Previous month') | t">
            <app-icon name="chevron" [size]="18" class="rot-left" />
          </button>
          <div class="dp-title">
            <button type="button" class="dp-title-btn" [class.on]="view() === 'months'" (click)="setView('months')">{{ monthName(cursor().m) }}</button>
            <button type="button" class="dp-title-btn" [class.on]="view() === 'years'" (click)="setView('years')">{{ cursor().y }}</button>
          </div>
          <button type="button" class="dp-nav" (click)="step(1)" [disabled]="!canStep(1)" [attr.aria-label]="(view() === 'years' ? 'Later years' : 'Next month') | t">
            <app-icon name="chevron" [size]="18" class="rot-right" />
          </button>
        </div>

        @switch (view()) {
          @case ('days') {
            <div class="dp-grid dp-days" role="grid">
              @for (w of weekdays(); track $index) { <span class="dp-weekday" aria-hidden="true">{{ w }}</span> }
              @for (c of days(); track c.key) {
                <button type="button" class="dp-day" role="gridcell" [attr.data-key]="c.key"
                  [class.out]="!c.inMonth" [class.today]="c.today" [class.selected]="c.selected" [class.active]="c.key === activeKey()"
                  [disabled]="c.disabled" [attr.aria-selected]="c.selected" [attr.aria-current]="c.today ? 'date' : null"
                  [attr.tabindex]="c.key === activeKey() ? 0 : -1" [attr.aria-label]="ariaDate(c.key)" (click)="pick(c.key)">{{ c.day }}</button>
              }
            </div>
          }
          @case ('months') {
            <div class="dp-grid dp-months">
              @for (name of shortMonths(); track $index; let i = $index) {
                <button type="button" class="dp-cell" [class.selected]="isSelectedMonth(i + 1)" [class.current]="cursor().m === i + 1"
                  [disabled]="!monthAllowed(cursor().y, i + 1)" (click)="chooseMonth(i + 1)">{{ name }}</button>
              }
            </div>
          }
          @case ('years') {
            <div class="dp-grid dp-years">
              @for (y of years(); track y) {
                <button type="button" class="dp-cell" [attr.data-year]="y" [class.selected]="selected()?.y === y" [class.current]="cursor().y === y"
                  (click)="chooseYear(y)">{{ y }}</button>
              }
            </div>
          }
        }

        <div class="dp-foot">
          @if (todayAllowed()) { <button type="button" class="dp-link" (click)="pick(todayKey)">{{ 'Today' | t }}</button> } @else { <span></span> }
          @if (value()) { <button type="button" class="dp-link muted" (click)="clear()">{{ 'Clear' | t }}</button> }
        </div>
      </div>
    }
  `
})
export class DatePicker implements ControlValueAccessor {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly i18n = inject(I18n);

  readonly inputId = input('date');
  readonly min = input<string | null>(null);
  readonly max = input<string | null>(null);
  readonly placeholder = input('Select a date');
  /** Where the calendar opens when no date is set yet (e.g. "1995-01-01" for birth dates). */
  readonly startAt = input<string | null>(null);
  /** First view when empty: 'years' is quickest for birth dates. */
  readonly startView = input<View>('days');
  /** Show the age next to the date (birth dates). */
  readonly showAge = input(false);
  readonly invalid = input(false);
  readonly describedBy = input<string | null>(null);

  protected readonly value = signal<string>('');
  protected readonly disabled = signal(false);
  protected readonly open = signal(false);
  protected readonly view = signal<View>('days');
  protected readonly cursor = signal<Ymd>(fromDate(new Date()));   // shown month/year + keyboard focus day

  /** Month and weekday names in the chosen language, from the browser's locale data. */
  private readonly longMonths = computed(() => {
    const f = dateFormatter(this.i18n, { month: 'long' });
    return MONTHS.map((_, i) => capitalize(f.format(new Date(2023, i, 1))));
  });
  protected readonly shortMonths = computed(() => {
    const f = dateFormatter(this.i18n, { month: 'short' });
    return MONTHS.map((_, i) => capitalize(f.format(new Date(2023, i, 1)).replace('.', '')));
  });
  // 2 January 2023 was a Monday.
  protected readonly weekdays = computed(() => {
    const f = dateFormatter(this.i18n, { weekday: 'short' });
    return WEEKDAYS.map((_, i) => capitalize(f.format(new Date(2023, 0, 2 + i)).replace('.', '')));
  });
  protected readonly todayKey = keyOf(fromDate(new Date()));

  private onChange: (v: string) => void = () => {};
  private onTouched: () => void = () => {};

  protected readonly selected = computed(() => parse(this.value()));
  protected readonly activeKey = computed(() => keyOf(this.cursor()));

  protected readonly label = computed(() => {
    const v = this.selected();
    return v ? dateFormatter(this.i18n, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(v.y, v.m - 1, v.d)) : this.i18n.t(this.placeholder());
  });

  protected readonly age = computed(() => {
    const v = this.selected();
    if (!this.showAge() || !v) return null;
    const t = fromDate(new Date());
    const a = t.y - v.y - (t.m < v.m || (t.m === v.m && t.d < v.d) ? 1 : 0);
    return a >= 0 && a < 130 ? a : null;
  });

  protected readonly days = computed<DayCell[]>(() => {
    const { y, m } = this.cursor();
    const first = new Date(y, m - 1, 1);
    const lead = (first.getDay() + 6) % 7; // Monday first
    const start = fromDate(new Date(y, m - 1, 1 - lead));
    const selectedKey = this.value();
    const cells: DayCell[] = [];
    for (let i = 0; i < 42; i++) {
      const d = shift(start, i);
      const key = keyOf(d);
      cells.push({ key, day: d.d, inMonth: d.m === m, disabled: !this.allowed(key), today: key === this.todayKey, selected: key === selectedKey });
    }
    return cells;
  });

  protected readonly years = computed(() => {
    const now = new Date().getFullYear();
    const max = parse(this.max())?.y ?? now + 10;
    const min = parse(this.min())?.y ?? now - 120;
    const list: number[] = [];
    for (let y = max; y >= min; y--) list.push(y);
    return list;
  });

  protected readonly todayAllowed = computed(() => this.allowed(this.todayKey));

  // ---- ControlValueAccessor
  writeValue(v: string | null): void { this.value.set(v ?? ''); }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(disabled: boolean): void { this.disabled.set(disabled); }

  // ---- helpers for the template
  protected monthName(m: number): string { return this.longMonths()[m - 1]; }
  protected ariaDate(key: string): string {
    const v = parse(key)!;
    return dateFormatter(this.i18n, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(v.y, v.m - 1, v.d));
  }
  protected isSelectedMonth(m: number): boolean {
    const s = this.selected();
    return !!s && s.y === this.cursor().y && s.m === m;
  }

  private allowed(key: string): boolean {
    const min = this.min(), max = this.max();
    return (!min || key >= min) && (!max || key <= max);
  }
  protected monthAllowed(y: number, m: number): boolean {
    return this.allowed(`${y}-${pad(m)}-${pad(daysIn(y, m))}`) || this.allowed(`${y}-${pad(m)}-01`);
  }

  // ---- open / close
  protected toggle(): void { this.open() ? this.close(false) : this.openPanel(); }

  private openPanel(): void {
    const start = this.selected() ?? parse(this.startAt()) ?? this.clampToRange(fromDate(new Date()));
    this.cursor.set(start);
    this.view.set(this.selected() ? 'days' : this.startView());
    this.open.set(true);
    this.focusSoon();
  }

  private close(returnFocus: boolean): void {
    this.open.set(false);
    this.onTouched();
    if (returnFocus) this.host.nativeElement.querySelector('.dp-trigger')?.focus();
  }

  protected onDocumentClick(e: MouseEvent): void {
    // composedPath() is fixed when the click starts, so it still counts clicks on buttons
    // that were removed from the page by the click itself (e.g. switching to the month view).
    if (this.open() && !e.composedPath().includes(this.host.nativeElement)) this.close(false);
  }

  // ---- choosing
  protected pick(key: string): void {
    if (!this.allowed(key)) return;
    this.value.set(key);
    this.onChange(key);
    this.close(true);
  }

  protected clear(): void {
    this.value.set('');
    this.onChange('');
    this.close(true);
  }

  protected setView(v: View): void {
    this.view.set(this.view() === v ? 'days' : v);
    this.focusSoon();
  }

  protected chooseYear(y: number): void {
    const c = this.cursor();
    this.cursor.set({ y, m: c.m, d: Math.min(c.d, daysIn(y, c.m)) });
    this.view.set('months');
    this.focusSoon();
  }

  protected chooseMonth(m: number): void {
    const c = this.cursor();
    this.cursor.set(this.clampToRange({ y: c.y, m, d: Math.min(c.d, daysIn(c.y, m)) }));
    this.view.set('days');
    this.focusSoon();
  }

  protected step(dir: number): void {
    if (this.view() === 'years') {
      this.host.nativeElement.querySelector('.dp-years')?.scrollBy({ top: dir * 160, behavior: 'smooth' });
      return;
    }
    if (this.view() === 'months') { this.cursor.set({ ...this.cursor(), y: this.cursor().y + dir }); return; }
    this.cursor.set(addMonths(this.cursor(), dir));
    this.focusSoon();
  }

  protected canStep(dir: number): boolean {
    if (this.view() !== 'days') return true;
    const next = addMonths(this.cursor(), dir);
    return this.monthAllowed(next.y, next.m);
  }

  private clampToRange(v: Ymd): Ymd {
    const key = keyOf(v), min = this.min(), max = this.max();
    if (max && key > max) return parse(max)!;
    if (min && key < min) return parse(min)!;
    return v;
  }

  // ---- keyboard
  protected onTriggerKey(e: KeyboardEvent): void {
    if (!this.open() && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault();
      this.openPanel();
    }
  }

  protected onPanelKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.close(true); return; }
    if (this.view() !== 'days') return;
    const c = this.cursor();
    const moves: Record<string, () => Ymd> = {
      ArrowLeft: () => shift(c, -1), ArrowRight: () => shift(c, 1),
      ArrowUp: () => shift(c, -7), ArrowDown: () => shift(c, 7),
      PageUp: () => addMonths(c, e.shiftKey ? -12 : -1), PageDown: () => addMonths(c, e.shiftKey ? 12 : 1),
      Home: () => shift(c, -((new Date(c.y, c.m - 1, c.d).getDay() + 6) % 7)),
      End: () => shift(c, 6 - ((new Date(c.y, c.m - 1, c.d).getDay() + 6) % 7))
    };
    if (moves[e.key]) {
      e.preventDefault();
      this.cursor.set(this.clampToRange(moves[e.key]()));
      this.focusSoon();
    } else if (e.key === 'Enter' || e.key === ' ') {
      if ((e.target as HTMLElement).classList.contains('dp-day')) { e.preventDefault(); this.pick(this.activeKey()); }
    }
  }

  /** After a view change, focus the active day, or scroll the chosen year into view. */
  private focusSoon(): void {
    setTimeout(() => {
      const root = this.host.nativeElement as HTMLElement;
      if (this.view() === 'days') {
        root.querySelector<HTMLElement>(`.dp-day[data-key="${this.activeKey()}"]`)?.focus({ preventScroll: true });
      } else if (this.view() === 'years') {
        const box = root.querySelector<HTMLElement>('.dp-years');
        const el = root.querySelector<HTMLElement>(`[data-year="${this.cursor().y}"]`);
        if (box && el) box.scrollTop = el.offsetTop - box.clientHeight / 2 + el.offsetHeight / 2;
        el?.focus({ preventScroll: true });
      } else {
        root.querySelector<HTMLElement>('.dp-months .current')?.focus({ preventScroll: true });
      }
    });
  }
}

function capitalize(s: string): string { return s.charAt(0).toLocaleUpperCase() + s.slice(1); }
