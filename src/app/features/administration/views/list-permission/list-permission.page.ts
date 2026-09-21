import { Component, inject } from '@angular/core';
import { ApiService } from '@/core/services/api.service';

@Component({
  selector: 'app-list-permission',
  imports: [],
  templateUrl: './list-permission.page.html',
  styleUrl: './list-permission.page.scss'
})
export class ListPermissionPage {
  private apiService = inject(ApiService);
}
