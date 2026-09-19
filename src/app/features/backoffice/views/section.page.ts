import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-section-page',
  standalone: true,
  template: `
    <section class="py-4">
      <h2 class="mb-2">{{ title }}</h2>
      <p class="text-secondary">{{ description }}</p>
      <div class="alert alert-light border mb-0" role="status">
        Cet écran est prêt à recevoir ses formulaires et ses données API.
      </div>
    </section>
  `,
})
export class SectionPage {
  private readonly route = inject(ActivatedRoute);
  protected readonly title = this.route.snapshot.data['title'] as string;
  protected readonly description = this.route.snapshot.data['description'] as string;
}
