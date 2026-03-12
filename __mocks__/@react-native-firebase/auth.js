// @react-native-firebase/auth のテスト環境モック
const mockAuth = jest.fn(() => ({
  currentUser: null,
  signInAnonymously: jest.fn().mockResolvedValue({ user: { uid: 'test-uid' } }),
  // テスト環境では即座にコールバックを呼び "Auth 初期化済み" を模倣する
  onAuthStateChanged: jest.fn(callback => {
    callback(null); // currentUser = null で即時発火
    return () => {}; // unsubscribe 関数
  }),
}));

module.exports = mockAuth;
module.exports.default = mockAuth;
