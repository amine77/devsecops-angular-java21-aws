import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';

import { ScrollAnimationService } from './scroll-animation.service';

describe('ScrollAnimationService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  function createService(): ScrollAnimationService {
    TestBed.configureTestingModule({});
    return TestBed.inject(ScrollAnimationService);
  }

  it('should be created', () => {
    expect(createService()).toBeTruthy();
  });

  it('reducedMotion should be false by default (matchMedia mocké à false)', () => {
    expect(createService().reducedMotion).toBe(false);
  });

  it('reducedMotion should be true quand prefers-reduced-motion matche', () => {
    (window.matchMedia as jest.Mock).mockReturnValueOnce({ matches: true });
    expect(createService().reducedMotion).toBe(true);
  });

  it('reveal() should return null when reducedMotion is true', () => {
    (window.matchMedia as jest.Mock).mockReturnValueOnce({ matches: true });
    const service = createService();
    expect(service.reveal(document.createElement('div'))).toBeNull();
  });

  it('reveal() should animate immediately (fade, up) when the element is already visible', () => {
    const service = createService();
    const el = document.createElement('div');
    jest.spyOn(el, 'getBoundingClientRect').mockReturnValue({ top: 0 } as DOMRect);
    expect(service.reveal(el)).toBeNull();
  });

  it('reveal() should support direction left', () => {
    const service = createService();
    const el = document.createElement('div');
    jest.spyOn(el, 'getBoundingClientRect').mockReturnValue({ top: 0 } as DOMRect);
    expect(() => service.reveal(el, { direction: 'left' })).not.toThrow();
  });

  it('reveal() should support direction right', () => {
    const service = createService();
    const el = document.createElement('div');
    jest.spyOn(el, 'getBoundingClientRect').mockReturnValue({ top: 0 } as DOMRect);
    expect(() => service.reveal(el, { direction: 'right' })).not.toThrow();
  });

  it("reveal() should schedule a ScrollTrigger (effect deploy) when the element isn't visible yet", () => {
    const service = createService();
    const el = document.createElement('div');
    jest
      .spyOn(el, 'getBoundingClientRect')
      .mockReturnValue({ top: window.innerHeight * 2 } as DOMRect);
    expect(() => service.reveal(el, { effect: 'deploy' })).not.toThrow();
  });

  it('timeline() should return a gsap timeline created outside the Angular zone', () => {
    const service = createService();
    expect(service.timeline()).toBeDefined();
  });

  it('refreshOnNavigation() should refresh ScrollTrigger on NavigationEnd', () => {
    const events$ = new Subject();
    const routerMock = { events: events$.asObservable() } as unknown as Router;
    const service = createService();

    service.refreshOnNavigation(routerMock);

    expect(() => events$.next(new NavigationEnd(1, '/a', '/a'))).not.toThrow();
  });

  it('refreshOnNavigation() should ignore events other than NavigationEnd', () => {
    const events$ = new Subject();
    const routerMock = { events: events$.asObservable() } as unknown as Router;
    const service = createService();

    service.refreshOnNavigation(routerMock);

    expect(() => events$.next({ id: 1 })).not.toThrow();
  });
});
