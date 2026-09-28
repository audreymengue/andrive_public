import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ListRolePage } from './list-role.page';

describe('ListRolePage', () => {
  let component: ListRolePage;
  let fixture: ComponentFixture<ListRolePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListRolePage]
    }).compileComponents();

    fixture = TestBed.createComponent(ListRolePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
