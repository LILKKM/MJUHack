import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createHongGilDong } from './hongGilDongGLB';

jest.mock('three/addons/loaders/GLTFLoader.js', () => ({ GLTFLoader: jest.fn() }), { virtual: true });
jest.mock('three', () => {
  class Group {
    constructor() { this.children = []; this.rotation = { x: 0, y: 0 }; this.scale = { setScalar: jest.fn() }; }
    add(child) { this.children.push(child); }
    clear() { this.children = []; }
    traverse(fn) { fn(this); this.children.forEach(child => child.traverse(fn)); }
  }
  return {
    Group, Vector3: jest.fn(), LoopOnce: 'once', MathUtils: { degToRad: value => value * Math.PI / 180 },
    AnimationMixer: jest.fn(),
  };
});
let finish, fail;
beforeEach(() => {
  jest.clearAllMocks();
  THREE.AnimationMixer.mockImplementation(() => ({
    clipAction: jest.fn(clip => ({ name: clip.name, setLoop: jest.fn(), reset: jest.fn().mockReturnThis(), play: jest.fn().mockReturnThis(), crossFadeTo: jest.fn() })),
    addEventListener: jest.fn(), update: jest.fn(), stopAllAction: jest.fn(), uncacheRoot: jest.fn(),
  }));
  GLTFLoader.mockImplementation(() => ({ load: jest.fn((url, onLoad, progress, onError) => { finish = onLoad; fail = onError; }) }));
});
function asset() {
  const scene = new THREE.Group();
  const body = new THREE.Group();
  body.geometry = { dispose: jest.fn() };
  body.material = { dispose: jest.fn(), map: { isTexture: true, dispose: jest.fn() } };
  scene.add(body);
  const head = new THREE.Group(); head.isBone = true; head.name = 'head'; scene.add(head);
  const animations = ['CloudFlight', 'Landing', 'Idle', 'Run', 'Showcase'].map(name => ({ name }));
  return { scene, animations, body, head };
}
function mixer() { return THREE.AnimationMixer.mock.results.at(-1).value; }
function action(name) { return mixer().clipAction.mock.results.map(result => result.value).find(value => value.name === name); }
test('readiness waits for the GLB and map pose set before loading survives', () => {
  const onLoad = jest.fn(); const hero = createHongGilDong({ onLoad });
  expect(onLoad).not.toHaveBeenCalled();
  hero.setMapPose(true); finish(asset());
  expect(onLoad).toHaveBeenCalledWith({ clips: ['CloudFlight', 'Landing', 'Idle', 'Run', 'Showcase'] });
  expect(hero.root.children[0].rotation.x).toBeCloseTo(-52 * Math.PI / 180);
  expect(action('Landing').play).toHaveBeenCalled(); hero.dispose();
});
test('pause freezes the mixer, reduced motion selects Idle, head look does not accumulate', () => {
  const hero = createHongGilDong(); const gltf = asset(); finish(gltf);
  hero.lookAtViewer(true); hero.animate(0); hero.animate(.05);
  expect(mixer().update).toHaveBeenLastCalledWith(.05);
  const calls = mixer().update.mock.calls.length;
  hero.animate(.1, { paused: true });
  expect(mixer().update).toHaveBeenCalledTimes(calls);
  hero.animate(.15);
  expect(gltf.head.rotation.y).toBeCloseTo(.1);
  hero.setMapPose(true); hero.animate(.2, { reduced: true });
  expect(action('Idle').play).toHaveBeenCalled();
  expect(mixer().update).toHaveBeenLastCalledWith(0);
  hero.animate(10); expect(mixer().update).toHaveBeenLastCalledWith(.1); hero.dispose();
});
test('Landing completion transitions to Idle', () => {
  const hero = createHongGilDong(); finish(asset()); hero.setMapPose(true);
  mixer().addEventListener.mock.calls[0][1]({ action: action('Landing') });
  expect(action('Idle').play).toHaveBeenCalled(); hero.dispose();
});
test('loaded or late assets dispose resources once without late callbacks', () => {
  for (const late of [false, true]) {
    const onLoad = jest.fn(), onError = jest.fn();
    const hero = createHongGilDong({ onLoad, onError }); const gltf = asset();
    if (late) hero.dispose();
    finish(gltf); hero.dispose(); hero.dispose(); fail(new Error('late failure'));
    expect(gltf.body.geometry.dispose).toHaveBeenCalledTimes(1);
    expect(gltf.body.material.dispose).toHaveBeenCalledTimes(1);
    expect(gltf.body.material.map.dispose).toHaveBeenCalledTimes(1);
    expect(onLoad).toHaveBeenCalledTimes(late ? 0 : 1);
    expect(onError).not.toHaveBeenCalled();
  }
});
test('active loading errors use the failure callback', () => {
  const onError = jest.fn(); const hero = createHongGilDong({ onError });
  const error = new Error('missing GLB'); fail(error);
  expect(onError).toHaveBeenCalledWith(error); hero.dispose();
});
