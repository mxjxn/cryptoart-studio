(function () {
  const EXTENSION_ABI_DERIVED =
    'function getDerivedValue(uint256 tokenId, bytes32 key) view returns (bytes32)';
  const EXTENSION_ABI_PARAM =
    'function getParameter(uint256 tokenId, bytes32 key) view returns (bytes32)';
  const EXTENSION_ABI_SEED = 'function seed(uint256 tokenId) view returns (bytes32)';

  function parseLocation() {
    const url = new URL(window.location.href);
    const preview =
      window.__CRYPTOART_PREVIEW__ ||
      (url.searchParams.get('cryptoart_preview') === '1'
        ? { mode: 'preview', tokenId: url.searchParams.get('tokenId') || '1', seed: url.searchParams.get('seed') }
        : null);
  const params = {};
    for (const [k, v] of url.searchParams.entries()) {
      if (k.startsWith('param.')) params[k.slice(6)] = v;
    }
    return {
      mode: preview?.mode || (url.searchParams.get('extension') ? 'live' : 'preview'),
      chainId: Number(url.searchParams.get('chainId') || preview?.chainId || 0) || undefined,
      collection: url.searchParams.get('collection') || preview?.collection,
      extension: url.searchParams.get('extension') || preview?.extension,
      tokenId: url.searchParams.get('tokenId') || preview?.tokenId || '1',
      rpcUrl: url.searchParams.get('rpcUrl') || preview?.rpcUrl,
      seed: url.searchParams.get('seed') || preview?.seed,
      params: { ...(preview?.params || {}), ...params },
      derived: { ...(preview?.derived || {}) },
    };
  }

  function mulberry32(seedHex) {
    const cleaned = String(seedHex).replace(/^0x/, '');
    let a = parseInt(cleaned.slice(0, 8), 16) || 1;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function keccakUtf8(label) {
    if (window.ethers && window.ethers.id) return window.ethers.id(label);
    throw new Error('Live mode requires ethers (or pre-filled URL params). Use cryptoart_preview=1 in Studio.');
  }

  async function ethCall(rpcUrl, to, data) {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [{ to, data }, 'latest'],
      }),
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error.message || 'rpc error');
    return json.result;
  }

  function encodeCall(signature, argsHex) {
    if (window.ethers && window.ethers.Interface) {
      const iface = new window.ethers.Interface([`function ${signature}`]);
      const name = signature.split('(')[0];
      return iface.encodeFunctionData(name, argsHex).slice(2);
    }
    return null;
  }

  const state = parseLocation();
  const ready = (async () => {
    if (state.mode === 'live' && state.extension && state.rpcUrl && window.ethers) {
      const tokenId = BigInt(state.tokenId);
      const seedData = encodeCall('seed(uint256)', [tokenId]);
      if (seedData) {
        const raw = await ethCall(state.rpcUrl, state.extension, '0x' + seedData);
        state.seed = raw;
      }
    }
    if (!state.seed) {
      state.seed = '0x' + Math.floor(Math.random() * 1e9).toString(16) + 'cafebabe';
    }
    state._random = mulberry32(state.seed);
    return state;
  })();

  const api = {
    ready,
    get mode() {
      return state.mode;
    },
    get seed() {
      return state.seed;
    },
    get tokenId() {
      return state.tokenId;
    },
    get random() {
      return state._random || Math.random;
    },
    param(key, fallback) {
      if (state.params && key in state.params) return state.params[key];
      return fallback;
    },
    derived(key) {
      if (state.derived && key in state.derived) return state.derived[key];
      return undefined;
    },
    async loadDerived(label) {
      if (state.mode !== 'live' || !state.extension || !state.rpcUrl) return undefined;
      const key = keccakUtf8(label);
      const tokenId = BigInt(state.tokenId);
      const data = encodeCall('getDerivedValue(uint256,bytes32)', [tokenId, key]);
      if (!data) return undefined;
      const raw = await ethCall(state.rpcUrl, state.extension, '0x' + data);
      state.derived[label] = raw;
      return raw;
    },
    notifyReady() {
      document.documentElement.setAttribute('data-cryptoart-ready', 'true');
      if (typeof window.cryptoartPreviewCapture === 'function') {
        window.cryptoartPreviewCapture();
      }
    },
  };

  window.$cryptoart = api;

  // Minimal processing-style globals for the p5 starter template
  let _canvas;
  let _ctx;
  let width = 0;
  let height = 0;
  let _fill = [200, 80, 90, 1];
  let _stroke = null;
  let _hsb = false;

  window.createCanvas = function (w, h) {
    _canvas = document.createElement('canvas');
    _canvas.width = w;
    _canvas.height = h;
    width = w;
    height = h;
    document.body.appendChild(_canvas);
    _ctx = _canvas.getContext('2d');
    return _canvas;
  };
  window.colorMode = function (mode) {
    _hsb = mode === 'HSB' || mode === 360;
  };
  window.background = function () {
    if (!_ctx) return;
    _ctx.clearRect(0, 0, width, height);
    if (arguments.length >= 3) {
      const [h, s, l] = arguments;
      _ctx.fillStyle = _hsb ? `hsl(${h},${s}%,${l}%)` : `rgb(${h},${s},${l})`;
      _ctx.fillRect(0, 0, width, height);
    }
  };
  window.fill = function () {
    if (arguments.length >= 3) {
      const a = arguments.length >= 4 ? arguments[3] : 1;
      const [h, s, l] = arguments;
      _fill = [h, s, l, a];
    }
  };
  window.noStroke = function () {
    _stroke = null;
  };
  window.ellipse = function (x, y, w, h) {
    if (!_ctx) return;
    const [hue, sat, light, a] = _fill;
    _ctx.fillStyle = _hsb
      ? `hsla(${hue},${sat}%,${light}%,${a})`
      : `rgba(${hue},${sat},${light},${a})`;
    _ctx.beginPath();
    _ctx.ellipse(x, y, w / 2, (h || w) / 2, 0, 0, Math.PI * 2);
    _ctx.fill();
  };
  window.noLoop = function () {};
  window.setup = function () {};
  ready.then(function () {
    if (typeof window.setup === 'function') window.setup();
  });
})();