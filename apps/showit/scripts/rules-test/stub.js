const store = {};
const fn = function () { return null; };
const special = {
  I18nManager: { isRTL: false, allowRTL() {}, forceRTL() {}, swapLeftAndRightInRTL() {} },
  Platform: { OS: 'web', select: (o) => (o.web ?? o.default) },
  StyleSheet: { create: (x) => x, absoluteFillObject: {}, hairlineWidth: 1 },
  Dimensions: { get: () => ({ width: 400, height: 800 }), addEventListener: () => ({ remove() {} }) },
  Animated: new Proxy({}, { get: () => fn }),
  default: { getItem: async (k) => store[k] ?? null, setItem: async (k, v) => { store[k] = v; }, removeItem: async () => {} },
  getItem: async (k) => store[k] ?? null,
  setItem: async (k, v) => { store[k] = v; },
};
module.exports = new Proxy(special, { get: (t, k) => (k in t ? t[k] : k === '__esModule' ? true : fn) });
