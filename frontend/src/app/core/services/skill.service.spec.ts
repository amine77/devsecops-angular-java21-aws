import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { SkillService } from './skill.service';
import { Skill } from '@shared/models/skill.model';

describe('SkillService', () => {
  let service: SkillService;
  let httpMock: HttpTestingController;

  const mockSkill: Skill = {
    id: 1,
    name: 'Java',
    category: 'BACKEND',
    iconUrl: null,
    level: 'INTERMEDIAIRE',
    sortOrder: 1,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(SkillService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('getAllSkills() should return skills array', () => {
    service.getAllSkills().subscribe((skills) => {
      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('Java');
    });

    const req = httpMock.expectOne((r) => r.url.includes('/skills'));
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: [mockSkill] });
  });

  it('getSkillsByCategory() should pass category param', () => {
    service.getSkillsByCategory('BACKEND').subscribe((skills) => {
      expect(skills).toHaveLength(1);
    });

    const req = httpMock.expectOne((r) => r.url.includes('/skills') && r.params.has('category'));
    expect(req.request.params.get('category')).toBe('BACKEND');
    req.flush({ success: true, data: [mockSkill] });
  });
});
