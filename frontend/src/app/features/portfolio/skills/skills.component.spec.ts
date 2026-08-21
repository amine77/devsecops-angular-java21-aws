import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';

import { SkillsComponent } from './skills.component';
import { SkillService } from '@core/services/skill.service';
import { Skill } from '@shared/models/skill.model';

describe('SkillsComponent', () => {
  let fixture: ComponentFixture<SkillsComponent>;
  let component: SkillsComponent;

  const mockSkills: Skill[] = [
    { id: 1, name: 'Java', category: 'BACKEND', iconUrl: null, level: 'EXPERT', sortOrder: 1 },
    { id: 2, name: 'Angular', category: 'FRONTEND', iconUrl: null, level: 'AVANCE', sortOrder: 1 },
  ];

  const mockSkillService = {
    getAllSkills: jest.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SkillsComponent, RouterTestingModule, HttpClientTestingModule],
      providers: [{ provide: SkillService, useValue: mockSkillService }],
    }).compileComponents();

    fixture = TestBed.createComponent(SkillsComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => jest.clearAllMocks());

  it('should create', () => {
    mockSkillService.getAllSkills.mockReturnValue(of([]));
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should load and group skills by category', () => {
    mockSkillService.getAllSkills.mockReturnValue(of(mockSkills));
    fixture.detectChanges();
    expect(component['isLoading']()).toBe(false);
    expect(component['skillGroups']()).toHaveLength(2);
  });

  it('should set isLoading false on error', () => {
    mockSkillService.getAllSkills.mockReturnValue(throwError(() => new Error('err')));
    fixture.detectChanges();
    expect(component['isLoading']()).toBe(false);
  });

  it('categoryLabel() returns readable label', () => {
    expect(component['categoryLabel']('BACKEND')).toBeTruthy();
  });

  it('categoryIcon() returns an emoji', () => {
    expect(component['categoryIcon']('BACKEND')).toBe('⚙️');
    expect(component['categoryIcon']('UNKNOWN' as never)).toBe('🔧');
  });
});
