import { Component, inject, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MenuItem } from '@/core/config/menu';
import { MenuService } from '@/core/services/menu.service';

@Component({
  selector: 'app-nav-menu',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, AppNavMenuComponent],
  templateUrl: './app-nav-menu.component.html',
  styleUrl: './app-nav-menu.component.scss',
})
export class AppNavMenuComponent {
  items = input<MenuItem[]>([]);
  nested = input(false);

  protected menuService = inject(MenuService);
}
