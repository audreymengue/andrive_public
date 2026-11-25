import { Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';

import { AppNavMenuComponent } from '@/shared/components/app-nav-menu/app-nav-menu.component';
import { MenuService } from '@/core/services/menu.service';
import { CoreService } from '@/core/services/core.service';
import { NotificationCenterComponent } from '@/shared/components/notification-center/notification-center.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, AppNavMenuComponent, NotificationCenterComponent],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss'
})
export class MainLayout {

  protected menuService = inject(MenuService);

  private readonly coreService = inject(CoreService);
  private readonly router = inject(Router);
  protected readonly afficherNotifications = signal(false);

  constructor() {
    this.mettreAJourVisibiliteNotifications(this.router.url);
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      takeUntilDestroyed(),
    ).subscribe(event => this.mettreAJourVisibiliteNotifications(event.urlAfterRedirects));
  }

  private mettreAJourVisibiliteNotifications(url: string): void {
    const path = url.split(/[?#]/, 1)[0].replace(/\/$/, '');
    this.afficherNotifications.set(path === '/dashboard' || path.startsWith('/dashboard/'));
  }

  logout(): void {
    this.coreService.logout();
    this.router.navigate(['/login']);
  }
}
