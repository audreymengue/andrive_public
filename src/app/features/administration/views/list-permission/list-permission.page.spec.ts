import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ListPermissionPage } from './list-permission.page';

describe('ListPermissionPage', () => {
  let component: ListPermissionPage;
  let fixture: ComponentFixture<ListPermissionPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListPermissionPage]
    }).compileComponents();

    fixture = TestBed.createComponent(ListPermissionPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
