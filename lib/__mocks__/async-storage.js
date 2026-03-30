// Mock for @react-native-async-storage/async-storage
// Used by MetaMask SDK but not needed for web
module.exports = {
  default: {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
    clear: async () => {},
  },
  getItem: async () => null,
  setItem: async () => {},
  removeItem: async () => {},
  clear: async () => {},
};
