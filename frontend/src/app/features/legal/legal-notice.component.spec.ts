import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { LegalNoticeComponent } from './legal-notice.component';

describe('LegalNoticeComponent', () => {
  let fixture: ComponentFixture<LegalNoticeComponent>;
  let component: LegalNoticeComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LegalNoticeComponent, RouterTestingModule],
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
    expect(compiled.querySelector('h1')?.textContent).toContain('Mentions légales');
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
