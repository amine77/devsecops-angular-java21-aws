import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';

import { NavbarComponent } from './navbar.component';
import { AuthService } from '@core/services/auth.service';

describe('NavbarComponent', () => {
  let fixture: ComponentFixture<NavbarComponent>;
  let component: NavbarComponent;

  const mockAuthService = {
    isAuthenticated: jest.fn().mockReturnValue(false),
    isAdmin: jest.fn().mockReturnValue(false),
    displayName: signal('Admin'),
    logout: jest.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        NavbarComponent,
        RouterTestingModule,
        HttpClientTestingModule,
        NoopAnimationsModule,
      ],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compileComponents();

    fixture = TestBed.createComponent(NavbarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => jest.clearAllMocks());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show login button when not authenticated', () => {
    mockAuthService.isAuthenticated.mockReturnValue(false);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('nav.login');
  });

  it('should change language on setLang()', () => {
    component.setLang('en');
    expect(component['langService'].current()).toBe('en');
    component.setLang('fr');
  });

  it('should call logout on authService', () => {
    component.logout();
    expect(mockAuthService.logout).toHaveBeenCalled();
  });

  it('should have 3 language options', () => {
    expect(component['languages']).toHaveLength(3);
    expect(component['languages'].map((l) => l.code)).toEqual(['fr', 'en', 'de']);
  });
});
