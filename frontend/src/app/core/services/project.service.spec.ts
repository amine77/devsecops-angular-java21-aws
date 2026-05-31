import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { ProjectService } from './project.service';
import { Project } from '@shared/models/project.model';

describe('ProjectService', () => {
  let service: ProjectService;
  let httpMock: HttpTestingController;

  const mockProject: Project = {
    id: 1,
    title: 'Portfolio DevSecOps',
    description: 'Desc',
    summary: null,
    githubUrl: null,
    demoUrl: null,
    imageUrl: null,
    featured: true,
    sortOrder: 1,
    status: 'ACTIVE',
    skills: [],
    createdAt: '',
    updatedAt: '',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(ProjectService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('getProjects() should send GET with pagination params', () => {
    service.getProjects(0, 9).subscribe((page) => {
      expect(page.content).toHaveLength(1);
    });

    const req = httpMock.expectOne((r) => r.url.includes('/projects') && r.params.has('page'));
    expect(req.request.method).toBe('GET');
    req.flush({
      success: true,
      data: { content: [mockProject], totalElements: 1, totalPages: 1, size: 9, number: 0 },
    });
  });

  it('getFeaturedProjects() should GET /projects/featured', () => {
    service.getFeaturedProjects().subscribe((projects) => {
      expect(projects).toHaveLength(1);
    });

    const req = httpMock.expectOne((r) => r.url.includes('/featured'));
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: [mockProject] });
  });
});
