export type GenerativeTemplateId = 'p5-starter' | 'canvas-webgl' | 'svg-starter';

export type GenerativeTemplate = {
  id: GenerativeTemplateId;
  title: string;
  description: string;
  /** Self-contained HTML document artists can pin and mint. */
  html: string;
};

const RUNTIME_SNIPPET = `<script src="https://cryptoart.studio/generative/cryptoart-runtime.js"></script>`;

const SHARED_HEAD = `
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: #0a0a0a; }
    canvas, svg { display: block; width: 100vw; height: 100vh; }
  </style>
  ${RUNTIME_SNIPPET}
`;

export const GENERATIVE_TEMPLATES: GenerativeTemplate[] = [
  {
    id: 'p5-starter',
    title: 'P5-style canvas sketch',
    description: '2D canvas sketch driven by $cryptoart seed and params (no external libraries).',
    html: `<!DOCTYPE html>
<html lang="en">
<head>${SHARED_HEAD}</head>
<body>
<script>
  function setup() {
    const rand = $cryptoart.random;
    const canvas = createCanvas(window.innerWidth, window.innerHeight);
    const ctx = canvas.getContext('2d');
    const hue = Number($cryptoart.param('hue', 200));
    const n = Math.floor(rand() * 40) + 20;
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < n; i++) {
      const x = rand() * canvas.width;
      const y = rand() * canvas.height;
      const s = rand() * 120 + 12;
      const light = rand() * 60 + 30;
      ctx.fillStyle = 'hsla(' + ((hue + rand() * 80) % 360) + ', 70%, ' + light + '%, 0.85)';
      ctx.beginPath();
      ctx.ellipse(x, y, s / 2, (s * (rand() + 0.25)) / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    $cryptoart.notifyReady();
  }
  window.addEventListener('resize', () => location.reload());
</script>
</body>
</html>`,
  },
  {
    id: 'canvas-webgl',
    title: 'WebGL grid',
    description: 'WebGL shader-free gradient mesh from seed.',
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  ${SHARED_HEAD}
</head>
<body>
<canvas id="c"></canvas>
<script>
  const canvas = document.getElementById('c');
  const gl = canvas.getContext('webgl');
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  resize();
  const rand = $cryptoart.random;
  const hue = Number($cryptoart.param('hue', 145));
  const vs = gl.createShader(gl.VERTEX_SHADER);
  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(vs, 'attribute vec2 p; void main(){ gl_Position = vec4(p,0,1);}');
  gl.shaderSource(fs, \`precision mediump float; uniform float t; uniform float h; void main(){ vec2 uv = gl_FragCoord.xy / vec2(\${canvas.width}.0, \${canvas.height}.0); float v = 0.5 + 0.5*sin(t + uv.x*10.0 + h); gl_FragColor = vec4(h/360.0, uv.y*v, 1.0-v, 1.0); }\`);
  gl.compileShader(vs); gl.compileShader(fs);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog); gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const tLoc = gl.getUniformLocation(prog, 't');
  const hLoc = gl.getUniformLocation(prog, 'h');
  const t0 = rand() * Math.PI * 2;
  gl.uniform1f(hLoc, hue);
  gl.uniform1f(tLoc, t0);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  $cryptoart.notifyReady();
  window.addEventListener('resize', resize);
</script>
</body>
</html>`,
  },
  {
    id: 'svg-starter',
    title: 'SVG flow fields',
    description: 'Deterministic SVG paths from seed.',
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  ${SHARED_HEAD}
</head>
<body>
<svg id="s" xmlns="http://www.w3.org/2000/svg"></svg>
<script>
  const svg = document.getElementById('s');
  const w = window.innerWidth, h = window.innerHeight;
  svg.setAttribute('viewBox', \`0 0 \${w} \${h}\`);
  const rand = $cryptoart.random;
  const stroke = $cryptoart.param('stroke', '#7cf0ff');
  const n = Math.floor(rand() * 60) + 30;
  for (let i = 0; i < n; i++) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    let x = rand() * w, y = rand() * h, d = \`M \${x} \${y}\`;
    for (let j = 0; j < 8; j++) {
      x += (rand() - 0.5) * 120;
      y += (rand() - 0.5) * 120;
      d += \` L \${x} \${y}\`;
    }
    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', stroke);
    path.setAttribute('stroke-width', String(rand() * 2 + 0.5));
    path.setAttribute('opacity', String(rand() * 0.6 + 0.3));
    svg.appendChild(path);
  }
  $cryptoart.notifyReady();
</script>
</body>
</html>`,
  },
];

export function getGenerativeTemplate(id: GenerativeTemplateId): GenerativeTemplate | undefined {
  return GENERATIVE_TEMPLATES.find((t) => t.id === id);
}