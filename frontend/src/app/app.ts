import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';
import { NAV_ITEMS } from './core/nav';
import { NotificationsService } from './core/notifications.service';
import { ProfileService } from './core/profile.service';
import { CartService } from './core/cart.service';
import { Avatar } from './shared/avatar';
import { ChatWidget } from './shared/chat-widget';
import { ThemeService } from './core/theme.service';
import { Logo } from './shared/logo';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Logo, Avatar, ChatWidget],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="topbar">
      <a class="brand" routerLink="/">
        <app-logo [size]="38" />
        <span class="brand-text">
          <strong>UMBRELLA</strong>
          <small>Medical Center</small>
        </span>
      </a>

      <button
        class="menu-toggle"
        type="button"
        aria-label="Toggle menu"
        [attr.aria-expanded]="menuOpen()"
        (click)="menuOpen.set(!menuOpen())">☰</button>

      <nav [class.open]="menuOpen()" (click)="menuOpen.set(false)">
        @for (item of items(); track item.path) {
          <a [routerLink]="item.path" routerLinkActive="active">{{ item.label }}</a>
        }

        @if (cart.count() > 0) {
          <a class="bell" routerLink="/store" [attr.aria-label]="'Cart: ' + cart.count() + ' items'">
            <span aria-hidden="true">🛒</span>
            <span class="nav-badge" aria-hidden="true">{{ cart.count() }}</span>
          </a>
        }
        @if (auth.isLoggedIn()) {
          <a class="bell" routerLink="/notifications" routerLinkActive="active"
            [attr.aria-label]="notifications.unread() > 0 ? notifications.unread() + ' unread notifications' : 'Notifications'">
            <span aria-hidden="true">🔔</span>
            @if (notifications.unread() > 0) {
              <span class="nav-badge" aria-hidden="true">{{ notifications.unread() > 99 ? '99+' : notifications.unread() }}</span>
            }
          </a>
          <a class="me-link" routerLink="/account" [attr.aria-label]="'My profile: ' + (profile.me()?.displayName ?? auth.email())">
            <app-avatar size="small" [url]="profile.me()?.photoUrl ?? null" [name]="profile.me()?.displayName ?? auth.email() ?? ''" />
            <span class="who">{{ profile.me()?.displayName ?? auth.email() }} · {{ auth.role() }}</span>
          </a>
          <button class="btn small" type="button" (click)="logout()">Log out</button>
        } @else {
          <a routerLink="/login" routerLinkActive="active">Log in</a>
          <a class="btn primary small" routerLink="/register">Register</a>
        }

        <button
          class="theme-toggle"
          type="button"
          [attr.aria-label]="theme.theme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
          (click)="theme.toggle()">{{ theme.theme() === 'dark' ? '☀' : '☾' }}</button>
      </nav>
    </header>

    <main class="container">
      <router-outlet />
    </main>

    <footer class="footer">© {{ year }} Umbrella Medical Center</footer>

    <app-chat-widget />
  `
})
export class App {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  protected readonly notifications = inject(NotificationsService);
  protected readonly profile = inject(ProfileService);
  protected readonly cart = inject(CartService);
  protected readonly menuOpen = signal(false);
  protected readonly year = new Date().getFullYear();

  protected readonly items = computed(() => {
    const role = this.auth.role();
    return NAV_ITEMS.filter(item => !item.roles || (role !== null && item.roles.includes(role)));
  });

  protected logout(): void {
    this.auth.logout();
  }
}