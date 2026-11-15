import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { Specialization } from '../core/model';
import { Icon, specialtyIcon } from './icon';
import { I18n, TranslatePipe } from '../core/i18n';

interface Option { id: number | null; name: string; description: string | null; icon: string; count: number | null; }

/**
 * A styled specialty picker (replaces the plain browser dropdown): icons, descriptions, doctor counts,
 * a quick filter, and full keyboard support (arrows, Enter, Escape, typing to filter).
 */
@Component({
  selector: 'app-specialty-select',
  imports: [TranslatePipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'onDocumentClick($event)'
  },
  template: `
    <button #trigger type="button" class="ss-trigger" [id]="inputId()" [class.open]="open()"
      aria-haspopup="listbox" [attr.aria-expanded]="open()" [attr.aria-controls]="inputId() + '-list'"
      (click)="toggle()" (keydown)="onTriggerKey($event)">
      <span class="ss-icon"><app-icon [name]="selected().icon" [size]="18" /></span>
      <span class="ss-label">{{ selected().name | t }}</span>
      @if (selected().count !== null) { <span class="ss-count">{{ selected().count }}</span> }
      <app-icon class="ss-chevron" name="chevron" [size]="18" />
    </button>

    @if (open()) {
      <div class="ss-panel" (keydown)="onPanelKey($event)">
        <div class="ss-filter">
          <app-icon name="search" [size]="16" />
          <input #filterInput type="text" [placeholder]="'Filter specialties' | t" [attr.aria-label]="'Filter specialties' | t" autocomplete="off"
            [value]="filter()" (input)="filter.set($any($event.target).value); active.set(0)" />
        </div>
        <ul class="ss-list" role="listbox" [id]="inputId() + '-list'" [attr.aria-activedescendant]="optionId(active())">
          @for (o of visible(); track o.id; let i = $index) {
            <li role="option" class="ss-option" [id]="optionId(i)"
              [class.active]="i === active()" [class.selected]="o.id === value()" [attr.aria-selected]="o.id === value()"
              (mouseenter)="active.set(i)" (click)="choose(o)">
              <span class="ss-icon"><app-icon [name]="o.icon" [size]="18" /></span>
              <span class="ss-text">
                <strong>{{ o.name | t }}</strong>
                @if (o.description) { <small>{{ o.description | t }}</small> }
              </span>
              @if (o.count !== null) { <span class="ss-count">{{ o.count }}</span> }
              @if (o.id === value()) { <app-icon class="ss-check" name="check" [size]="18" /> }
            </li>
          } @empty {
            <li class="ss-empty">{{ 'No specialty matches "{q}".' | t: { q: filter() } }}</li>
          }
        </ul>
      </div>
    }
  `
})
export class SpecialtySelect {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly i18n = inject(I18n);
  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private readonly filterInput = viewChild<ElementRef<HTMLInputElement>>('filterInput');

  readonly specializations = input.required<Specialization[]>();
  readonly value = input<number | null>(null);
  /** Doctors per specialization id, shown next to each name. */
  readonly counts = input<Record<number, number> | null>(null);
  readonly inputId = input('specialty');
  readonly valueChange = output<number | null>();

  protected readonly open = signal(false);
  protected readonly filter = signal('');
  protected readonly active = signal(0);

  private readonly options = computed<Option[]>(() => {
    const counts = this.counts();
    const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : null;
    return [
      { id: null, name: 'All specializations', description: null, icon: 'cross', count: total },
      // Alphabetical in the chosen language.
      ...[...this.specializations()].sort((a, b) => this.i18n.t(a.name).localeCompare(this.i18n.t(b.name), this.i18n.locale())).map(s => ({
        id: s.id, name: s.name, description: s.description, icon: specialtyIcon(s.name), count: counts ? counts[s.id] ?? 0 : null
      }))
    ];
  });

  protected readonly visible = computed(() => {
    const q = this.filter().trim().toLowerCase();
    const has = (s: string | null) => !!s && (s.toLowerCase().includes(q) || this.i18n.t(s).toLowerCase().includes(q));
    return q ? this.options().filter(o => o.id !== null && (has(o.name) || has(o.description)))
             : this.options();
  });

  protected readonly selected = computed(() => this.options().find(o => o.id === this.value()) ?? this.options()[0]);

  protected optionId(index: number): string {
    return `${this.inputId()}-opt-${index}`;
  }

  protected toggle(): void {
    this.open() ? this.close(false) : this.openPanel();
  }

  protected choose(o: Option): void {
    if (o.id !== this.value()) this.valueChange.emit(o.id);
    this.close(true);
  }

  protected onTriggerKey(e: KeyboardEvent): void {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key) && !this.open()) {
      e.preventDefault();
      this.openPanel();
    }
  }

  protected onPanelKey(e: KeyboardEvent): void {
    const count = this.visible().length;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.active.set(Math.min(count - 1, this.active() + 1));
        this.scrollActive();
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.active.set(Math.max(0, this.active() - 1));
        this.scrollActive();
        break;
      case 'Enter': {
        e.preventDefault();
        const o = this.visible()[this.active()];
        if (o) this.choose(o);
        break;
      }
      case 'Escape':
        e.preventDefault();
        this.close(true);
        break;
      case 'Tab':
        this.close(false);
        break;
    }
  }

  protected onDocumentClick(e: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.close(false);
  }

  private openPanel(): void {
    this.filter.set('');
    this.open.set(true);
    const index = this.options().findIndex(o => o.id === this.value());
    this.active.set(Math.max(0, index));
    setTimeout(() => {
      this.filterInput()?.nativeElement.focus();
      this.scrollActive();
    });
  }

  private close(returnFocus: boolean): void {
    this.open.set(false);
    if (returnFocus) this.trigger()?.nativeElement.focus();
  }

  private scrollActive(): void {
    setTimeout(() => document.getElementById(this.optionId(this.active()))?.scrollIntoView({ block: 'nearest' }));
  }
}
