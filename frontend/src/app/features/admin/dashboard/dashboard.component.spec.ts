import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { signal } from '@angular/core';

import { DashboardComponent } from './dashboard.component';
import { ProjectService } from '@core/services/project.service';
import { AuthService } from '@core/services/auth.service';

describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let component: DashboardComponent;

  const mockProjectService = {
    getProjects: jest.fn(),
    deleteProject: jest.fn(),
  };

  const mockAuthService = {
    displayName: signal('Admin'),
    isAuthenticated: jest.fn().mockReturnValue(true),
    isAdmin: jest.fn().mockReturnValue(true),
  };

  beforeEach(async () => {
    mockProjectService.getProjects.mockReturnValue(
      of({ content: [], totalElements: 0, totalPages: 0, size: 50, number: 0 })
    );

    await TestBed.configureTestingModule({
      imports: [
        DashboardComponent,
        RouterTestingModule,
        HttpClientTestingModule,
        MatDialogModule,
        MatSnackBarModule,
        NoopAnimationsModule,
      ],
      providers: [
        { provide: ProjectService, useValue: mockProjectService },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => jest.clearAllMocks());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load projects on init', () => {
    expect(mockProjectService.getProjects).toHaveBeenCalledWith(0, 50);
    expect(component['isLoading']()).toBe(false);
  });
});
