// react-native-google-mobile-ads のテスト環境モック
const mockAd = {
  load: jest.fn(),
  show: jest.fn().mockResolvedValue(undefined),
  addAdEventListener: jest.fn(() => jest.fn()),
};

module.exports = {
  InterstitialAd: {
    createForAdRequest: jest.fn(() => mockAd),
  },
  AdEventType: {
    LOADED: 'loaded',
    CLOSED: 'closed',
    ERROR: 'error',
  },
  TestIds: {
    INTERSTITIAL: 'ca-app-pub-3940256099942544/1033173712',
  },
  MobileAds: jest.fn(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
  })),
};
