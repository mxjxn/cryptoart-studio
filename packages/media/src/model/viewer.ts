/** See docs/plans/model-viewer-customization-todo.md — layout/theme not configurable yet. */

import type { ModelFileFormat } from './mime';
import type { ModelViewerEngine } from './validate';

export type ModelViewerInput = {
  title: string;
  creator?: string;
  modelUrl: string;
  posterUrl?: string;
  format: ModelFileFormat;
  engine: ModelViewerEngine;
};

export function buildModelViewerHtml(input: ModelViewerInput): string {
  return input.engine === 'three'
    ? buildThreeViewerHtml(input)
    : buildModelViewerComponentHtml(input);
}

function buildModelViewerComponentHtml(input: ModelViewerInput): string {
  const title = escapeHtml(input.title || 'Untitled');
  const modelUrl = escapeHtml(input.modelUrl);
  const poster = input.posterUrl ? escapeHtml(input.posterUrl) : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; background: #e8e8ea; }
  model-viewer { width: 100%; height: 100%; min-height: 360px; --poster-color: transparent; }
  .bar { position: fixed; left: 0; right: 0; bottom: 0; padding: 10px 16px; background: rgba(12,12,14,0.72); color: #f4f4f6; font-family: system-ui,sans-serif; font-size: 0.875rem; }
</style>
<script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js"></script>
</head>
<body>
  <model-viewer src="${modelUrl}"
    ${poster ? `poster="${poster}"` : ''}
    alt="${title}"
    camera-controls
    auto-rotate
    shadow-intensity="0.85"
    exposure="1"
    environment-image="neutral"
    interaction-prompt="none">
  </model-viewer>
  <div class="bar">${title}</div>
</body>
</html>`;
}

function buildThreeViewerHtml(input: ModelViewerInput): string {
  const title = escapeHtml(input.title || 'Untitled');
  const modelUrl = escapeHtml(input.modelUrl);
  const format = input.format;
  const loader =
    format === 'fbx'
      ? 'FBXLoader'
      : 'OBJLoader';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; overflow: hidden; background: #e8e8ea; font-family: system-ui,sans-serif; }
  #c { display: block; width: 100%; height: 100%; }
  .bar { position: fixed; left: 0; right: 0; bottom: 0; padding: 10px 16px; background: rgba(12,12,14,0.72); color: #f4f4f6; font-size: 0.875rem; pointer-events: none; }
</style>
<script type="importmap">
{
  "imports": {
    "three": "https://esm.sh/three@0.170.0",
    "three/addons/": "https://esm.sh/three@0.170.0/examples/jsm/"
  }
}
</script>
</head>
<body>
<canvas id="c"></canvas>
<div class="bar">${title}</div>
<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ${loader} } from 'three/addons/loaders/${loader}.js';

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0xe8e8ea, 1);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 2000);
camera.position.set(2.2, 1.4, 2.6);

const ambient = new THREE.AmbientLight(0xffffff, 0.85);
const key = new THREE.DirectionalLight(0xffffff, 0.9);
key.position.set(4, 8, 6);
scene.add(ambient, key);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.autoRotate = true;
controls.autoRotateSpeed = 1.2;

const loader = new ${loader}();
loader.load(${JSON.stringify(modelUrl)}, (loaded) => {
  const obj = loaded;
  scene.add(obj);
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3()).length() || 1;
  const center = box.getCenter(new THREE.Vector3());
  obj.position.sub(center);
  camera.position.set(size * 0.8, size * 0.55, size * 1.05);
  camera.lookAt(0, 0, 0);
  controls.update();
}, undefined, () => {});

function tick() {
  requestAnimationFrame(tick);
  controls.update();
  renderer.render(scene, camera);
}
tick();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
</script>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}