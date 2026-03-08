// @react-native-firebase/firestore のテスト環境モック

// ── ドキュメント参照モック ─────────────────────────────────
const mockDoc = {
  set: jest.fn().mockResolvedValue(undefined),
  update: jest.fn().mockResolvedValue(undefined),
  get: jest.fn().mockResolvedValue({ exists: false, data: () => undefined }),
  onSnapshot: jest.fn((onNext) => {
    onNext({ exists: false, data: () => undefined });
    return jest.fn(); // unsubscribe
  }),
};

// ── コレクション参照モック ───────────────────────────────────
const mockCollection = {
  doc: jest.fn(() => mockDoc),
  add: jest.fn().mockResolvedValue({ id: 'mock-doc-id' }),
};

// ── トランザクション内の tx オブジェクト ─────────────────────
// テスト側で mockTxGet.mockResolvedValueOnce(...) を使って挙動を制御する
const mockTxGet = jest.fn().mockResolvedValue({ exists: false, data: () => undefined });
const mockTxUpdate = jest.fn();

// ── firestore() 本体 ─────────────────────────────────────────
const mockFirestore = jest.fn(() => ({
  collection: jest.fn(() => mockCollection),
  runTransaction: jest.fn(async (cb) => {
    const tx = { get: mockTxGet, update: mockTxUpdate };
    return cb(tx);
  }),
}));

mockFirestore.FieldValue = {
  arrayUnion: jest.fn((...args) => args),
  delete: jest.fn(() => 'DELETE'),
};

// テストファイルからアクセスできるよう内部モックを公開
mockFirestore._mockDoc = mockDoc;
mockFirestore._mockCollection = mockCollection;
mockFirestore._mockTxGet = mockTxGet;
mockFirestore._mockTxUpdate = mockTxUpdate;

module.exports = mockFirestore;
module.exports.default = mockFirestore;
