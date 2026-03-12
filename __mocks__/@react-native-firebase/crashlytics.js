const mockCrashlytics = {
  setCrashlyticsCollectionEnabled: jest.fn(),
  recordError: jest.fn(),
  log: jest.fn(),
};

export default () => mockCrashlytics;
