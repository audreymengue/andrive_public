import { Component, inject } from '@angular/core';
import { ApiService } from '@/core/services/api.service';

@Component({
  selector: 'app-list-role',
  imports: [],
  templateUrl: './list-role.page.html',
  styleUrl: './list-role.page.scss'
})
export class ListRolePage {
  private apiService = inject(ApiService);
}
