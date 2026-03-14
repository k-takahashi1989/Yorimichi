// @react-native-firebase/messaging のテスト環境モック
const mockMessaging = jest.fn(() => ({
  getToken: jest.fn().mockResolvedValue('mock-fcm-token'),
  onTokenRefresh: jest.fn((_cb) => jest.fn()), // unsubscribe
  onMessage: jest.fn((_cb) => jest.fn()),       // unsubscribe
  setBackgroundMessageHandler: jest.fn(),
  requestPermission: jest.fn().mockResolvedValue(1),
}));

module.exports = mockMessaging;
module.exports.default = mockMessaging;
