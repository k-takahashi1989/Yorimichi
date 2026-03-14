// @react-native-firebase/functions のテスト環境モック
const mockCallable = jest.fn().mockResolvedValue({ data: {} });

const mockFunctions = jest.fn(() => ({
  httpsCallable: jest.fn(() => mockCallable),
}));

// テストファイルからアクセスできるよう内部モックを公開
mockFunctions._mockCallable = mockCallable;

module.exports = mockFunctions;
module.exports.default = mockFunctions;
