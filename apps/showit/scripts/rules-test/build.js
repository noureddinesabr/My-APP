const esbuild = require('esbuild');
const path = require('path');
const stub = path.join(__dirname, 'stub.js');
esbuild.build({
  entryPoints: [path.join(__dirname, 'rules.test.ts')],
  bundle: true, platform: 'node', format: 'cjs', outfile: path.join(__dirname, 'out.js'),
  nodePaths: [path.join(__dirname, '../../node_modules')],
  jsx: 'automatic', logLevel: 'error',
  loader: { '.webp': 'empty', '.png': 'empty', '.jpg': 'empty', '.ttf': 'empty', '.mp3': 'empty', '.wav': 'empty', '.glb': 'empty' },
  plugins: [{ name: 'stub', setup(b) { b.onResolve({ filter: /^(react-native|react-native-.*|@react-native.*|@expo\/.*|expo|expo-.*|@anthropic-ai\/.*|leaflet|react-leaflet|@maplibre.*|maplibre.*)(\/.*)?$/ }, () => ({ path: stub })); } }],
}).catch(() => process.exit(1));
