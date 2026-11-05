import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createHongGilDong } from './hongGilDongGLB';
import { landingView } from './cameraTimeline';
const ease = n => n*n*(3-2*n);
export function createHeroScene(canvas, onCamera, { onLoad, onError } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference:'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1,.1,100);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = .07; controls.enablePan = false;
  controls.minDistance = 4.5; controls.maxDistance = 26;
  controls.minPolarAngle = .25; controls.maxPolarAngle = Math.PI*.64;
  scene.add(new THREE.HemisphereLight('#e4f5ff','#90a5ab',1.8));
  const sun = new THREE.DirectionalLight('#fff1cf',3.0); sun.position.set(-4,7,6);
  sun.castShadow = true; sun.shadow.mapSize.set(1024,1024); sun.shadow.camera.left=-5; sun.shadow.camera.right=5; sun.shadow.camera.top=6; sun.shadow.camera.bottom=-3; sun.shadow.normalBias=.035; scene.add(sun);
  const rim = new THREE.DirectionalLight('#a9d9ff',2.4); rim.position.set(4,3,-4); scene.add(rim);
  const hero = createHongGilDong({ onLoad, onError }); scene.add(hero.root);
  let portrait, lastPhase;
  const cameraStart = new THREE.Vector3(), targetStart = new THREE.Vector3();
  const fullCamera = new THREE.Vector3(4.6,3.0,7.3), fullTarget = new THREE.Vector3(0,1.25,0);
  function resize() {
    const width = canvas.clientWidth, height = canvas.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width,height,false); camera.aspect=width/Math.max(1,height); camera.updateProjectionMatrix();
    const framing = Math.max(1, .86 / camera.aspect);
    fullCamera.copy(fullTarget).add(new THREE.Vector3(4.6,1.75,7.3).multiplyScalar(framing));
    if(lastPhase==='flying'){camera.position.copy(fullCamera);controls.target.copy(fullTarget);controls.update();}
    portrait = camera.aspect < 1.05;
  }
  const observer=new ResizeObserver(resize); observer.observe(canvas); resize();
  function render({ phase, progress, time, paused, reduced, color, dt, anchor, hasPosition = true }) {
    const changed = lastPhase !== phase;
    if (changed) {
      if (phase==='revealing') { cameraStart.copy(camera.position); targetStart.copy(controls.target); }
      if (phase==='flying') { camera.position.copy(fullCamera); controls.target.copy(fullTarget); controls.update(); }
      lastPhase=phase;
    }
    controls.enabled = false;
    hero.root.visible=!['clouds','following','preparing'].includes(phase);
    hero.root.position.set(0,0,0); hero.root.rotation.set(0,-.25,0); hero.root.scale.setScalar(1);
    camera.clearViewOffset();
    camera.up.set(0,1,0);
    hero.setColor(color);
    hero.setMapPose(['falling','impact','pullback','landed'].includes(phase));
    hero.lookAtViewer(phase === 'flying');
    if (phase==='clouds') {
      camera.position.set(0,1.15,portrait?Math.max(12.4,7.8/camera.aspect):10.8); controls.target.set(0,1.15,0);
    } else if (phase==='revealing') {
      const t=ease(progress);
      camera.position.lerpVectors(cameraStart,fullCamera,t); controls.target.lerpVectors(targetStart,fullTarget,t);
      hero.root.position.set((1-t)*-1.5,Math.sin(progress*Math.PI)*.15,-12*(1-t));
      hero.root.rotation.y=-1.2+(1.2+.56)*t;
      hero.root.scale.setScalar(.75+t*.25);
    } else if (phase==='flying'||phase==='departing'||phase==='following'||phase==='preparing'||phase==='locating') {
      camera.position.copy(fullCamera); controls.target.copy(fullTarget);
      hero.root.rotation.y=.56;
      if (phase==='departing') {
        const drop=progress*progress;
        hero.root.position.y=-14*drop;
        hero.root.rotation.x=-.5*drop;
        hero.root.rotation.z=-.2*drop;
        hero.root.scale.setScalar(1-.25*drop);
      }
    } else if (['falling','impact','pullback','landed'].includes(phase)) {
      const view=landingView(phase,progress);
      const distance=8*view.distance;
      controls.target.set(0,-.144,0);
      camera.up.set(0,0,-1);
      camera.position.set(0,-.144+distance,0);
      if (anchor) camera.setViewOffset(canvas.clientWidth, canvas.clientHeight, canvas.clientWidth/2-anchor.x, canvas.clientHeight/2-anchor.y, canvas.clientWidth, canvas.clientHeight);
      hero.root.visible=hasPosition;
      onCamera?.({...view,anchor});
      hero.root.scale.setScalar(.30);
      if (phase==='falling') {
        const drop=progress**2;
        hero.root.position.set((1-drop)*1.6,0,-(1-drop)*12);
        hero.root.rotation.z=(1-drop)*-.35;
      } else {
        const recoil = reduced || phase!=='impact' ? 0 : Math.sin(progress*Math.PI*5)*Math.exp(-progress*5)*-.28;
        hero.root.rotation.z=recoil;
      }
    }
    hero.animate(time, { paused, reduced });
    if (!controls.enabled) camera.lookAt(controls.target);
    else controls.update();
    renderer.render(scene,camera);
  }
  return {
    render,
    dispose() {
      observer.disconnect(); controls.dispose(); hero.dispose();
      const geometries=new Set(), materials=new Set();
      scene.traverse(object=>{ if(object.geometry)geometries.add(object.geometry); if(object.material) (Array.isArray(object.material)?object.material:[object.material]).forEach(m=>materials.add(m)); });
      geometries.forEach(g=>g.dispose()); materials.forEach(m=>m.dispose()); renderer.dispose();
      // Fast Refresh reuses a connected canvas; losing that context prevents its next renderer from drawing.
      if (!canvas.isConnected) renderer.forceContextLoss();
    }
  };
}
