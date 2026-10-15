import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DemandeSortiePage } from './demande-sortie.page';

describe('DemandeSortiePage', () => {
  let component: DemandeSortiePage;
  let fixture: ComponentFixture<DemandeSortiePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DemandeSortiePage]
    }).compileComponents();

    fixture = TestBed.createComponent(DemandeSortiePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
