import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BackToTopComponent } from './back-to-top.component';

describe('BackToTopComponent', () => {
  let fixture: ComponentFixture<BackToTopComponent>;
  let component: BackToTopComponent;

  beforeEach(async () => {
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });

    await TestBed.configureTestingModule({
      imports: [BackToTopComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(BackToTopComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function button(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('button');
  }

  it('should be created', () => {
    expect(component).toBeTruthy();
  });

  it('should be hidden by default (scroll = 0)', () => {
    expect(button().classList).not.toContain('back-to-top--visible');
    expect(button().getAttribute('aria-hidden')).toBe('true');
    expect(button().tabIndex).toBe(-1);
  });

  it('should have a French aria-label', () => {
    expect(button().getAttribute('aria-label')).toBe('Revenir en haut de la page');
  });

  it('should become visible once scroll passes the threshold', () => {
    Object.defineProperty(window, 'scrollY', { value: 700, configurable: true });
    window.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();

    expect(button().classList).toContain('back-to-top--visible');
    expect(button().getAttribute('aria-hidden')).toBe('false');
    expect(button().tabIndex).toBe(0);
  });

  it('should hide again once scroll goes back under the threshold', () => {
    Object.defineProperty(window, 'scrollY', { value: 700, configurable: true });
    window.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();

    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
    window.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();

    expect(button().classList).not.toContain('back-to-top--visible');
  });

  it('should scroll smoothly to the top on click by default', () => {
    const scrollToSpy = jest.spyOn(window, 'scrollTo').mockImplementation(() => undefined);

    button().click();

    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('should scroll instantly when prefers-reduced-motion is enabled', () => {
    (window.matchMedia as jest.Mock).mockReturnValueOnce({ matches: true });
    const scrollToSpy = jest.spyOn(window, 'scrollTo').mockImplementation(() => undefined);

    button().click();

    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
  });

  it('should remove the scroll listener on destroy', () => {
    const removeSpy = jest.spyOn(window, 'removeEventListener');
    fixture.destroy();
    expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
  });
});
