jest.mock('../redisClient', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    setex: jest.fn(() => Promise.resolve()),
  },
}));
jest.mock('safe-browse-url-lookup', () => jest.fn());
jest.mock('link-shield', () => ({
  detectSuspiciousLink: jest.fn(() => ({ suspicious: false, reasons: [] })),
}));

const { checkUrlSafety, isWhitelisted } = require('../urlSafety');

describe('urlSafety whitelist', () => {
  it('allows LIFF URLs', async () => {
    expect(isWhitelisted('https://liff.line.me/1563196602-X6mLdDkW')).toBe(
      true
    );

    await expect(
      checkUrlSafety('https://LIFF.LINE.ME/1563196602-X6mLdDkW')
    ).resolves.toEqual({ safe: true, whitelisted: true });
  });
});
