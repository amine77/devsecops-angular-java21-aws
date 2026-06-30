const mockTl: Record<string, jest.Mock> = {};
const buildTl = (): Record<string, jest.Mock> => {
  ['from', 'fromTo', 'to', 'add', 'kill', 'pause', 'play'].forEach(
    (m) => (mockTl[m] = jest.fn().mockReturnThis()),
  );
  return mockTl;
};

const gsap = {
  registerPlugin: jest.fn(),
  ticker: { add: jest.fn(), remove: jest.fn() },
  timeline: jest.fn(() => buildTl()),
  fromTo: jest.fn(() => ({ scrollTrigger: null, kill: jest.fn() })),
  from: jest.fn(() => ({ scrollTrigger: null, kill: jest.fn() })),
  to: jest.fn(() => ({ scrollTrigger: null, kill: jest.fn() })),
  set: jest.fn(),
  utils: { toArray: jest.fn(() => []) },
};

export default gsap;
export { gsap };
