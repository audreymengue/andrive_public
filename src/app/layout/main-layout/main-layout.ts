import { Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';

import { AppNavMenuComponent } from '@/shared/components/app-nav-menu/app-nav-menu.component';
import { MenuService } from '@/core/services/menu.service';
import { CoreService } from '@/core/services/core.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, AppNavMenuComponent],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss'
})
export class MainLayout {

  protected menuService = inject(MenuService);

  private readonly coreService = inject(CoreService);
  private readonly router = inject(Router);

  logout(): void {
    this.coreService.logout();
    this.router.navigate(['/login']);
  }
}