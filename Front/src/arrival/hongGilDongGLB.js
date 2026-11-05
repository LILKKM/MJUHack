// Drop-in replacement for Front/src/arrival/hongGilDong.js: same createHongGilDong() return shape,
// but the figure is the rigged v3 GLB (5 clips on one skeleton; cloud and hat cords appear in CloudFlight only).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const DEFAULT_URL = `${(typeof process !== 'undefined' && process.env && process.env.PUBLIC_URL) || ''}/assets/3d/honggildong.glb`;
const MODEL_SCALE = 0.48;          // v3 units -> old hero size (hat top ~2.9, cloud top ~0.6)
const FADE = 0.35;

export function createHongGilDong({ url = DEFAULT_URL, onLoad, onError } = {}) {
  const root = new THREE.Group();
  root.name = 'Hong Gil-dong riding a cloud';
  const model = new THREE.Group();       // heroScene resets root transform every frame, so pose/scale live here
  model.scale.setScalar(MODEL_SCALE);
  root.add(model);

  let mixer = null, actions = new Map(), current = null, head = null;
  let lastTime = null, mapPose = false, lookAt = false, headOffset = 0, disposed = false;

  function release(object) {
    const geometries = new Set(), materials = new Set(), textures = new Set(), skeletons = new Set();
    object.traverse(node => {
      if (node.geometry) geometries.add(node.geometry);
      if (node.skeleton) skeletons.add(node.skeleton);
      if (node.material) (Array.isArray(node.material) ? node.material : [node.material]).forEach(material => materials.add(material));
    });
    materials.forEach(material => Object.values(material).forEach(value => { if (value?.isTexture) textures.add(value); }));
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
    textures.forEach(texture => { texture.dispose(); texture.source?.data?.close?.(); });
    skeletons.forEach(skeleton => skeleton.dispose());
  }

  function play(name, fade = FADE) {
    const next = actions.get(name);
    if (!next || next === current) return;
    next.reset().play();
    if (current) current.crossFadeTo(next, fade, false);
    current = next;
  }

  new GLTFLoader().load(url, gltf => {
    if (disposed) { release(gltf.scene); return; }
    gltf.scene.traverse(o => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; }
      if (o.isBone && o.name === 'head') head = o;
    });
    model.add(gltf.scene);
    mixer = new THREE.AnimationMixer(gltf.scene);
    for (const clip of gltf.animations) {
      const action = mixer.clipAction(clip);
      if (clip.name === 'Landing' || clip.name === 'Showcase') { action.setLoop(THREE.LoopOnce); action.clampWhenFinished = true; }
      actions.set(clip.name, action);
    }
    mixer.addEventListener('finished', e => { if (e.action === actions.get('Landing')) play('Idle'); });
    play(mapPose ? 'Landing' : 'CloudFlight', 0);
    mixer.update(0);
    onLoad?.({ clips: [...actions.keys()] });
  }, undefined, error => { if (!disposed) onError?.(error); });

  return {
    root,
    // Map phases: tilt toward the top-down camera (as before) and land: cloud vanishes, kneel, then stand.
    setMapPose(active) {
      model.rotation.x = active ? -THREE.MathUtils.degToRad(52) : 0;
      if (active !== mapPose) { mapPose = active; play(active ? 'Landing' : 'CloudFlight'); }
    },
    lookAtViewer(active) { lookAt = active; },
    // The v3 robe is part of one baked texture; recolouring it would tint the face too. Kept as a no-op.
    setColor() {},
    animate(time, { paused = false, reduced = false } = {}) {
      if (!mixer || disposed) return;
      const dt = lastTime === null ? 0 : Math.min(.1, Math.max(0, time - lastTime));
      lastTime = time;
      if (paused) return;
      if (head) head.rotation.y -= headOffset;
      headOffset = 0;
      if (reduced) {
        const still = actions.get(mapPose ? 'Idle' : 'CloudFlight');
        if (still) {
          mixer.stopAllAction();
          current = still.reset().play();
        }
        mixer.update(0);
      } else mixer.update(dt);
      if (head && lookAt) { head.rotation.y += .1; headOffset = .1; }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      mixer?.stopAllAction();
      if (mixer && model.children[0]) mixer.uncacheRoot(model.children[0]);
      release(model);
      model.clear();
      actions.clear();
      mixer = null;
      head = null;
    },
    play,
    get clips() { return [...actions.keys()]; },
    // Approximate focus points in root space (after MODEL_SCALE), for the existing hotspot camera moves.
    anchors: { cloud: new THREE.Vector3(0, .35, .35), hero: new THREE.Vector3(0, 2.35, .05), outfit: new THREE.Vector3(.15, 1.45, .3) },
  };
}
