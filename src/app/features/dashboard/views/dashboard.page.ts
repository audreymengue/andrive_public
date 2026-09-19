import { Component, inject } from '@angular/core';
import { CoreService } from '@/core/services/core.service';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  template: `
    <section class="py-4">
      <h2 class="mb-2">Tableau de bord</h2>
      <p class="text-secondary mb-0">Bienvenue{{ coreService.currentUser()?.name ? ', ' + coreService.currentUser()?.name : '' }}. Sélectionnez une rubrique dans le menu.</p>
    </section>
  `,
})
export class DashboardPage {
  protected readonly coreService = inject(CoreService);
}
