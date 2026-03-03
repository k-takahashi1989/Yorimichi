// react-native-device-info のテスト環境モック
module.exports = {
  default: {
    getVersion: jest.fn().mockReturnValue('1.0.8'),
    getBuildNumber: jest.fn().mockReturnValue('9'),
    getUniqueId: jest.fn().mockResolvedValue('test-device-id'),
    getUniqueIdSync: jest.fn().mockReturnValue('test-device-id'),
    getSystemVersion: jest.fn().mockReturnValue('13'),
    getBrand: jest.fn().mockReturnValue('TestBrand'),
    getModel: jest.fn().mockReturnValue('TestModel'),
  },
  getVersion: jest.fn().mockReturnValue('1.0.8'),
  getBuildNumber: jest.fn().mockReturnValue('9'),
  getUniqueId: jest.fn().mockResolvedValue('test-device-id'),
  getUniqueIdSync: jest.fn().mockReturnValue('test-device-id'),
  getSystemVersion: jest.fn().mockReturnValue('13'),
  getBrand: jest.fn().mockReturnValue('TestBrand'),
  getModel: jest.fn().mockReturnValue('TestModel'),
};
