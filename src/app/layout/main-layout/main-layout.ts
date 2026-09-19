import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppNavMenuComponent } from '@/shared/components/app-nav-menu/app-nav-menu.component';
import { MenuService } from '@/core/services/menu.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, AppNavMenuComponent],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss'
})
export class MainLayout {
  protected menuService = inject(MenuService);
}
