import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from './core/auth.service';
import { MAIN_NAV, WORK_MENU_LABEL, WORK_NAV } from './core/nav';
import { NotificationsService } from './core/notifications.service';
import { ProfileService } from './core/profile.service';
import { CartService } from './core/cart.service';
import { ThemeService } from './core/theme.service';
import { I18n, LANGUAGES, Lang, TranslatePipe } from './core/i18n';
import { ALWAYS_OPEN, CLINIC, openStatus } from './core/clinic';
import { Avatar } from './shared/avatar';
import { ChatWidget } from './shared/chat-widget';
import { Icon } from './shared/icon';
import { Logo } from './shared/logo';

type Menu = 'work' | 'user' | 'lang' | null;

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Logo, Avatar, ChatWidget, Icon, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'closeMenus()',
    '(document:keydown.escape)': 'closeMenus()'
  },
  template: `
    <a class="skip-link" href="#main">{{ 'Skip to content' | t }}</a>

    <header class="site-header">
      <div class="header-inner">
        <a class="brand" routerLink="/" [attr.aria-label]="'Umbrella Medical Center, home' | t">
          <app-logo [size]="36" />
          <span class="brand-text">
            <strong>UMBRELLA</strong>
            <small>{{ 'Medical Center' | t }}</small>
          </span>
        </a>

        <nav class="main-nav" [attr.aria-label]="'Main' | t">
          @for (item of mainNav; track item.path) {
            <a class="nav-link" [routerLink]="item.path" routerLinkActive="active">{{ item.label | t }}</a>
          }

          @if (workItems().length > 0) {
            <div class="menu-wrap">
              <button type="button" class="nav-link menu-trigger" [class.active]="workActive()"
                aria-haspopup="menu" [attr.aria-expanded]="openMenu() === 'work'" (click)="toggle('work', $event)">
                {{ workLabel() | t }}
                <app-icon name="chevron" [size]="16" [class.flip]="openMenu() === 'work'" />
              </button>
              @if (openMenu() === 'work') {
                <div class="dropdown" role="menu" (click)="$event.stopPropagation()">
                  @for (item of workItems(); track item.path) {
                    <a class="dropdown-item" role="menuitem" [routerLink]="item.path" routerLinkActive="active" (click)="closeMenus()">
                      <span class="dropdown-icon"><app-icon [name]="item.icon" [size]="18" /></span>
                      {{ item.label | t }}
                    </a>
                  }
                </div>
              }
            </div>
          }
        </nav>

        <div class="header-actions">
          @if (cart.count() > 0) {
            <a class="icon-btn" routerLink="/store" [attr.aria-label]="'Cart, {n} items' | t: { n: cart.count() }" [title]="'Cart' | t">
              <app-icon name="cart" [size]="20" />
              <span class="count-badge">{{ cart.count() }}</span>
            </a>
          }

          @if (auth.isLoggedIn()) {
            <a class="icon-btn" routerLink="/notifications" routerLinkActive="active" [title]="'Notifications' | t"
              [attr.aria-label]="notifications.unread() > 0 ? ('{n} unread notifications' | t: { n: notifications.unread() }) : ('Notifications' | t)">
              <app-icon name="bell" [size]="20" />
              @if (notifications.unread() > 0) {
                <span class="count-badge">{{ notifications.unread() > 99 ? '99+' : notifications.unread() }}</span>
              }
            </a>
          }

          <div class="menu-wrap">
            <button type="button" class="icon-btn lang-btn" aria-haspopup="menu" [attr.aria-expanded]="openMenu() === 'lang'"
              [attr.aria-label]="'Language' | t" [title]="'Language' | t" (click)="toggle('lang', $event)">
              <app-icon name="globe" [size]="19" />
              <span class="lang-code">{{ currentLang().short }}</span>
            </button>
            @if (openMenu() === 'lang') {
              <div class="dropdown dropdown-right lang-menu" role="menu" (click)="$event.stopPropagation()">
                @for (l of languages; track l.code) {
                  <button type="button" class="dropdown-item" role="menuitemradio" [attr.aria-checked]="l.code === i18n.lang()"
                    [class.active]="l.code === i18n.lang()" [attr.lang]="l.code" (click)="setLang(l.code)">
                    <span class="lang-chip">{{ l.short }}</span> {{ l.name }}
                    @if (l.code === i18n.lang()) { <app-icon class="lang-check" name="check" [size]="18" /> }
                  </button>
                }
              </div>
            }
          </div>

          <button type="button" class="icon-btn" (click)="theme.toggle()"
            [attr.aria-label]="(theme.theme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme') | t"
            [title]="(theme.theme() === 'dark' ? 'Light theme' : 'Dark theme') | t">
            <app-icon [name]="theme.theme() === 'dark' ? 'sun' : 'moon'" [size]="20" />
          </button>

          @if (auth.isLoggedIn()) {
            <div class="menu-wrap">
              <button type="button" class="user-trigger" aria-haspopup="menu" [attr.aria-expanded]="openMenu() === 'user'"
                [attr.aria-label]="'Account menu for {name}' | t: { name: displayName() }" (click)="toggle('user', $event)">
                <app-avatar size="small" [url]="profile.me()?.photoUrl ?? null" [name]="displayName()" />
                <span class="user-name">{{ firstName() }}</span>
                <app-icon name="chevron" [size]="16" [class.flip]="openMenu() === 'user'" />
              </button>
              @if (openMenu() === 'user') {
                <div class="dropdown dropdown-right" role="menu" (click)="$event.stopPropagation()">
                  <div class="dropdown-head">
                    <app-avatar [url]="profile.me()?.photoUrl ?? null" [name]="displayName()" />
                    <div>
                      <strong>{{ displayName() }}</strong>
                      <span>{{ (auth.role() ?? '') | t }}</span>
                      <span>{{ auth.email() }}</span>
                    </div>
                  </div>
                  <a class="dropdown-item" role="menuitem" routerLink="/account" (click)="closeMenus()">
                    <span class="dropdown-icon"><app-icon name="user" [size]="18" /></span> {{ 'My profile' | t }}
                  </a>
                  <a class="dropdown-item" role="menuitem" routerLink="/notifications" (click)="closeMenus()">
                    <span class="dropdown-icon"><app-icon name="bell" [size]="18" /></span> {{ 'Notifications' | t }}
                    @if (notifications.unread() > 0) { <span class="count-pill">{{ notifications.unread() }}</span> }
                  </a>
                  <div class="dropdown-sep"></div>
                  <button type="button" class="dropdown-item danger-item" role="menuitem" (click)="logout()">
                    <span class="dropdown-icon"><app-icon name="logout" [size]="18" /></span> {{ 'Log out' | t }}
                  </button>
                </div>
              }
            </div>
          } @else {
            <a class="nav-link login-link" routerLink="/login" routerLinkActive="active">{{ 'Log in' | t }}</a>
            <a class="btn primary small" routerLink="/register">{{ 'Register' | t }}</a>
          }

          <button type="button" class="icon-btn mobile-toggle" [attr.aria-expanded]="mobileOpen()" aria-controls="mobile-menu"
            [attr.aria-label]="(mobileOpen() ? 'Close menu' : 'Open menu') | t" (click)="mobileOpen.set(!mobileOpen()); $event.stopPropagation()">
            <app-icon [name]="mobileOpen() ? 'close' : 'menu'" [size]="22" />
          </button>
        </div>
      </div>

      @if (mobileOpen()) {
        <nav id="mobile-menu" class="mobile-menu" [attr.aria-label]="'Menu' | t" (click)="$event.stopPropagation()">
          @for (item of mainNav; track item.path) {
            <a class="mobile-item" [routerLink]="item.path" routerLinkActive="active" (click)="mobileOpen.set(false)">
              <app-icon [name]="item.icon" [size]="18" /> {{ item.label | t }}
            </a>
          }
          @if (workItems().length > 0) {
            <p class="mobile-heading">{{ workLabel() | t }}</p>
            @for (item of workItems(); track item.path) {
              <a class="mobile-item" [routerLink]="item.path" routerLinkActive="active" (click)="mobileOpen.set(false)">
                <app-icon [name]="item.icon" [size]="18" /> {{ item.label | t }}
              </a>
            }
          }
          <p class="mobile-heading">{{ 'Language' | t }}</p>
          <div class="mobile-langs">
            @for (l of languages; track l.code) {
              <button type="button" class="mobile-lang" [class.active]="l.code === i18n.lang()" [attr.lang]="l.code"
                [attr.aria-pressed]="l.code === i18n.lang()" (click)="setLang(l.code)">{{ l.name }}</button>
            }
          </div>
          <div class="mobile-sep"></div>
          @if (auth.isLoggedIn()) {
            <a class="mobile-item" routerLink="/account" (click)="mobileOpen.set(false)"><app-icon name="user" [size]="18" /> {{ 'My profile' | t }}</a>
            <button type="button" class="mobile-item" (click)="logout()"><app-icon name="logout" [size]="18" /> {{ 'Log out' | t }}</button>
          } @else {
            <a class="mobile-item" routerLink="/login" (click)="mobileOpen.set(false)"><app-icon name="user" [size]="18" /> {{ 'Log in' | t }}</a>
            <a class="btn primary block" routerLink="/register" (click)="mobileOpen.set(false)">{{ 'Create an account' | t }}</a>
          }
        </nav>
      }
    </header>

    <main id="main" class="container">
      <router-outlet />
    </main>

    <footer class="site-footer">
      <div class="footer-inner">
        <div class="footer-brand">
          <a class="brand" routerLink="/">
            <app-logo [size]="34" />
            <span class="brand-text"><strong>UMBRELLA</strong><small>{{ 'Medical Center' | t }}</small></span>
          </a>
          <p>{{ 'Specialist care, online booking and an on-site pharmacy in Tbilisi.' | t }}</p>
          <p class="footer-status" [class.open]="alwaysOpen || status().open">
            <span class="status-dot"></span>
            @if (alwaysOpen) {
              {{ 'Open 24/7, every day' | t }}
            } @else if (status().open) {
              {{ 'Open now · until {time}' | t: { time: status().until } }}
            } @else if (status().next; as next) {
              {{ 'Closed · opens {day} at {time}' | t: { day: dayName(next.day), time: next.time } }}
            }
          </p>
          <p class="footer-emergency"><strong>{{ 'Emergency:' | t }}</strong> {{ 'call' | t }} <a href="tel:112">112</a></p>
        </div>
        <nav class="footer-col" [attr.aria-label]="'Patients' | t">
          <h3>{{ 'Patients' | t }}</h3>
          <a routerLink="/doctors">{{ 'Find a doctor' | t }}</a>
          <a routerLink="/services">{{ 'Services and prices' | t }}</a>
          <a routerLink="/store">{{ 'Store' | t }}</a>
          @if (auth.isLoggedIn()) { <a routerLink="/account">{{ 'My profile' | t }}</a> } @else { <a routerLink="/register">{{ 'Create an account' | t }}</a> }
        </nav>
        <nav class="footer-col" [attr.aria-label]="'Your care' | t">
          <h3>{{ 'Your care' | t }}</h3>
          @if (auth.hasRole('Patient')) {
            <a routerLink="/appointments">{{ 'My appointments' | t }}</a>
            <a routerLink="/health">{{ 'My health' | t }}</a>
            <a routerLink="/orders">{{ 'My orders' | t }}</a>
            <a routerLink="/invoices">{{ 'My bills' | t }}</a>
          } @else {
            <a routerLink="/login">{{ 'Log in' | t }}</a>
            <a routerLink="/forgot-password">{{ 'Forgot password' | t }}</a>
          }
        </nav>
        <div class="footer-col">
          <h3>{{ 'Contact' | t }}</h3>
          <p><app-icon name="pin" [size]="16" /> {{ clinic.address }}, {{ 'Tbilisi' | t }}</p>
          <p><app-icon name="phone" [size]="16" /> <a [href]="'tel:' + clinic.phoneHref">{{ clinic.phone }}</a></p>
          <a routerLink="/contact">{{ 'Opening hours and contact form' | t }}</a>
          <a href="/swagger/" target="_blank" rel="noopener">{{ 'API documentation' | t }} ↗</a>
          <p>{{ 'Questions? Press Ask us at the bottom right.' | t }}</p>
        </div>
      </div>
      <div class="footer-bottom">© {{ year }} Umbrella Medical Center · {{ 'All rights reserved' | t }}</div>
    </footer>

    <app-chat-widget />
  `
})
export class App {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  protected readonly notifications = inject(NotificationsService);
  protected readonly profile = inject(ProfileService);
  protected readonly cart = inject(CartService);
  protected readonly i18n = inject(I18n);
  private readonly router = inject(Router);

  protected readonly mainNav = MAIN_NAV;
  protected readonly languages = LANGUAGES;
  protected readonly clinic = CLINIC;
  protected readonly alwaysOpen = ALWAYS_OPEN;
  protected readonly openMenu = signal<Menu>(null);
  protected readonly mobileOpen = signal(false);
  protected readonly year = new Date().getFullYear();
  protected readonly status = signal(openStatus());
  private readonly url = signal(this.router.url);

  protected readonly currentLang = computed(() => LANGUAGES.find(l => l.code === this.i18n.lang()) ?? LANGUAGES[0]);

  protected readonly workItems = computed(() => {
    const role = this.auth.role();
    return role === null ? [] : WORK_NAV.filter(item => item.roles?.includes(role));
  });
  protected readonly workLabel = computed(() => {
    const role = this.auth.role();
    return role ? WORK_MENU_LABEL[role] : '';
  });
  /** Highlights the role menu while one of its pages is open. */
  protected readonly workActive = computed(() =>
    this.workItems().some(item => this.url() === item.path || this.url().startsWith(item.path + '/') || this.url().startsWith(item.path + '?')));

  // Staff accounts without a person's name (the admin) show their role instead of repeating the email.
  protected readonly displayName = computed(() =>
    this.profile.me()?.displayName ?? (this.auth.role() === 'Admin' ? this.i18n.t('Administrator') : this.auth.email() ?? ''));
  protected readonly firstName = computed(() => {
    const name = this.displayName();
    if (name.includes('@')) return name.split('@')[0];
    const parts = name.replace(/^Dr\.\s*/, 'Dr. ').split(' ');
    return name.startsWith('Dr.') ? `Dr. ${parts[parts.length - 1]}` : parts[0];
  });

  constructor() {
    // Close menus whenever the page changes.
    this.router.events.pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed()).subscribe(e => {
      this.url.set((e as NavigationEnd).urlAfterRedirects);
      this.openMenu.set(null);
      this.mobileOpen.set(false);
      this.status.set(openStatus());
    });
  }

  protected dayName(day: number): string {
    // 2023-01-01 was a Sunday, so day 0..6 maps onto Jan 1..7.
    return new Intl.DateTimeFormat(this.i18n.locale(), { weekday: 'long' }).format(new Date(2023, 0, 1 + day));
  }

  protected setLang(lang: Lang): void {
    void this.i18n.use(lang);
    this.openMenu.set(null);
  }

  protected toggle(menu: Exclude<Menu, null>, event: Event): void {
    event.stopPropagation();
    this.openMenu.set(this.openMenu() === menu ? null : menu);
  }

  protected closeMenus(): void {
    this.openMenu.set(null);
    this.mobileOpen.set(false);
  }

  protected logout(): void {
    this.closeMenus();
    this.auth.logout();
  }
}
