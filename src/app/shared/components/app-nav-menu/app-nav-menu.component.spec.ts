import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppNavMenuComponent } from './app-nav-menu.component';
import { APP_MENU } from '@/core/config/menu';

describe('AppNavMenuComponent', () => {
  let fixture: ComponentFixture<AppNavMenuComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppNavMenuComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(AppNavMenuComponent);
    fixture.componentRef.setInput('items', APP_MENU);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
