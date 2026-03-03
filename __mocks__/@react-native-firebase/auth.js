// @react-native-firebase/auth のテスト環境モック
const mockAuth = jest.fn(() => ({
  currentUser: null,
  signInAnonymously: jest.fn().mockResolvedValue({ user: { uid: 'test-uid' } }),
}));

module.exports = mockAuth;
module.exports.default = mockAuth;
