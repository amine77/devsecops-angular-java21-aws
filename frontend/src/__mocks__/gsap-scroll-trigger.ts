export const ScrollTrigger = {
  create: jest.fn(() => ({ kill: jest.fn() })),
  refresh: jest.fn(),
  getAll: jest.fn(() => []),
  kill: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
};
