import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { LegalNoticeComponent } from './legal-notice.component';

describe('LegalNoticeComponent', () => {
  let fixture: ComponentFixture<LegalNoticeComponent>;
  let component: LegalNoticeComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LegalNoticeComponent, RouterTestingModule, HttpClientTestingModule],
    }).compileComponents();

    fixture = TestBed.createComponent(LegalNoticeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the legal notice title', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('legalNotice.title');
  });

  it('should contain a back link to /portfolio', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const backLink = compiled.querySelector('.back-link');
    expect(backLink).toBeTruthy();
  });

  it('should display the contact email', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('contact@charrad.dev');
  });
});
