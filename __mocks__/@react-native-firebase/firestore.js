// @react-native-firebase/firestore のテスト環境モック
const mockDoc = {
  set: jest.fn().mockResolvedValue(undefined),
  update: jest.fn().mockResolvedValue(undefined),
  get: jest.fn().mockResolvedValue({ exists: false, data: () => undefined }),
  onSnapshot: jest.fn((onNext) => {
    onNext({ exists: false, data: () => undefined });
    return jest.fn(); // unsubscribe
  }),
};

const mockCollection = {
  doc: jest.fn(() => mockDoc),
  add: jest.fn().mockResolvedValue({ id: 'mock-doc-id' }),
};

const mockFirestore = jest.fn(() => ({
  collection: jest.fn(() => mockCollection),
}));

mockFirestore.FieldValue = {
  arrayUnion: jest.fn((...args) => args),
  delete: jest.fn(() => 'DELETE'),
};

module.exports = mockFirestore;
module.exports.default = mockFirestore;
