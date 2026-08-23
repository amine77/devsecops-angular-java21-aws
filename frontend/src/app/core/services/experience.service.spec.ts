import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { ExperienceService } from './experience.service';
import { Experience, ExperienceFormData } from '@shared/models/experience.model';

describe('ExperienceService', () => {
  let service: ExperienceService;
  let httpMock: HttpTestingController;

  const mockExperience: Experience = {
    id: 1,
    entreprise: 'Allianz France',
    poste: 'Tech Lead',
    contexte: "Groupe d'assurance international",
    dateDebut: '2020-06-01',
    dateFin: undefined,
    current: true,
    description: 'Lead hands-on',
    realisations: ['Réalisation 1'],
    stack: ['Java 21'],
    ordreAffichage: 1,
    createdAt: '',
    updatedAt: '',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(ExperienceService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('getExperiences() should GET /experiences', () => {
    service.getExperiences().subscribe((experiences) => {
      expect(experiences).toHaveLength(1);
    });

    const req = httpMock.expectOne((r) => r.url.endsWith('/experiences') && r.method === 'GET');
    req.flush({ success: true, data: [mockExperience] });
  });

  it('getExperienceById() should GET /experiences/:id', () => {
    service.getExperienceById(1).subscribe((experience) => {
      expect(experience.id).toBe(1);
    });

    const req = httpMock.expectOne((r) => r.url.endsWith('/experiences/1') && r.method === 'GET');
    req.flush({ success: true, data: mockExperience });
  });

  it('createExperience() should POST the form data', () => {
    const formData: ExperienceFormData = {
      entreprise: 'Nouvelle entreprise',
      poste: 'Poste',
      dateDebut: '2020-01-01',
      description: 'Description',
      realisations: [],
      stack: [],
      ordreAffichage: 1,
    };

    service.createExperience(formData).subscribe((experience) => {
      expect(experience.id).toBe(1);
    });

    const req = httpMock.expectOne((r) => r.url.endsWith('/experiences') && r.method === 'POST');
    expect(req.request.body).toEqual(formData);
    req.flush({ success: true, data: mockExperience });
  });

  it('updateExperience() should PUT the form data', () => {
    const formData: ExperienceFormData = {
      entreprise: 'Allianz France',
      poste: 'Tech Lead',
      dateDebut: '2020-06-01',
      description: 'Description modifiée',
      realisations: [],
      stack: [],
      ordreAffichage: 1,
    };

    service.updateExperience(1, formData).subscribe((experience) => {
      expect(experience.id).toBe(1);
    });

    const req = httpMock.expectOne((r) => r.url.endsWith('/experiences/1') && r.method === 'PUT');
    expect(req.request.body).toEqual(formData);
    req.flush({ success: true, data: mockExperience });
  });

  it('deleteExperience() should DELETE by id', () => {
    service.deleteExperience(1).subscribe();

    const req = httpMock.expectOne(
      (r) => r.url.endsWith('/experiences/1') && r.method === 'DELETE'
    );
    req.flush(null);
  });
});
