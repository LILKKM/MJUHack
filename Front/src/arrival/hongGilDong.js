import * as THREE from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { ROBE_COLORS } from './heroConfig';
export function createHongGilDong() {
  const root = new THREE.Group();
  root.name = 'Hong Gil-dong riding a cloud';
  const materials = {
    robe: new THREE.MeshPhysicalMaterial({ color: ROBE_COLORS[0].color, roughness: .72, sheen: .8, sheenColor: new THREE.Color('#96b6d3') }),
    skin: new THREE.MeshStandardMaterial({ color: '#dca57a', roughness: .78 }),
    hair: new THREE.MeshStandardMaterial({ color: '#191c24', roughness: .75 }),
    red: new THREE.MeshStandardMaterial({ color: '#a43b33', roughness: .8 }),
    white: new THREE.MeshStandardMaterial({ color: '#f0e8d7', roughness: .95 }),
    shoe: new THREE.MeshStandardMaterial({ color: '#30323b', roughness: .6 }),
    wood: new THREE.MeshStandardMaterial({ color: '#754c32', roughness: .85 }),
    gold: new THREE.MeshStandardMaterial({ color: '#c9a86a', roughness: .4, metalness: .45 }),
    cloud: new THREE.MeshPhysicalMaterial({ color: '#faf2de', roughness: .92, sheen: .65, sheenColor: new THREE.Color('#c7dfed') })
  };
  const sphere = new THREE.SphereGeometry(1, 32, 24);
  function mesh(geometry, material, position, scale = [1,1,1], parent = root) {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(...position); object.scale.set(...scale);
    object.castShadow = true; object.receiveShadow = true;
    parent.add(object); return object;
  }
  const ellipsoid = (material, position, scale, parent = root) => mesh(sphere, material, position, scale, parent);
  function segment(from, to, topRadius, bottomRadius, material, parent = root) {
    const start = new THREE.Vector3(...from), end = new THREE.Vector3(...to);
    const direction = end.clone().sub(start);
    const object = mesh(new THREE.CylinderGeometry(topRadius, bottomRadius, direction.length(), 24), material, start.clone().add(end).multiplyScalar(.5).toArray(), [1,1,1], parent);
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), direction.normalize()); return object;
  }
  function cord(points, radius, material, parent = root) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    return mesh(new THREE.TubeGeometry(curve, 28, radius, 8, false), material, [0,0,0], [1,1,1], parent);
  }
  const mount = new THREE.Group(); mount.name = 'Flying cloud'; root.add(mount);
  const cloud = new MarchingCubes(42, materials.cloud, false, false, 40000);
  cloud.isolation = 32;
  cloud.reset();
  [[.20,.48,.50,.38],[.35,.55,.55,.48],[.50,.51,.50,.72],[.64,.51,.45,.5],[.78,.48,.50,.38],[.39,.55,.38,.35],[.63,.57,.63,.3],[.43,.64,.48,.35],[.61,.62,.49,.32]].forEach(([x,y,z,strength]) => cloud.addBall(x,y,z,strength,12));
  cloud.update(); cloud.scale.set(2.8, 1.25, 1.75); cloud.position.y = .28;
  cloud.castShadow = true; cloud.receiveShadow = true; mount.add(cloud);
  // Sculpted curls identify the mount independently of the background cloud volume.
  for (const [x,y,z,r] of [[-1.3,.35,.24,.35],[-.9,.63,.35,.38],[.86,.5,.33,.39],[1.27,.35,-.1,.3],[.44,.29,.70,.3],[-.4,.25,.7,.32]]) {
    const curl = mesh(new THREE.TorusGeometry(r,.07,10,40,Math.PI*1.65), materials.cloud, [x,y,z], [1,.85,1], mount);
    curl.rotation.z = x * .5;
  }
  const figure = new THREE.Group(); figure.position.set(0,.64,.05); figure.rotation.y = -.1; figure.name = 'Hong Gil-dong'; root.add(figure);
  // Bent legs, wide trousers and cloth shoes form a riding stance.
  segment([-.23,.48,0],[-.5,.22,.32],.22,.26,materials.white,figure);
  segment([.23,.5,0],[.43,.18,.1],.22,.25,materials.white,figure);
  ellipsoid(materials.shoe,[-.5,.12,.46],[.22,.12,.34],figure);
  ellipsoid(materials.shoe,[.43,.1,.24],[.22,.12,.32],figure);
  const skirt = mesh(new THREE.CylinderGeometry(.34,.60,.75,48,1,true),materials.robe,[0,.69,0],[1,1,.7],figure);
  skirt.rotation.z = -.04;
  const torso = mesh(new THREE.CylinderGeometry(.38,.36,.70,40), materials.robe,[0,1.23,0],[1,1,.65],figure);
  torso.rotation.z = -.06;
  // White crossed collar, red waist belt and knot.
  segment([-.28,1.59,.19],[.15,1.10,.29],.055,.065,materials.white,figure);
  segment([.25,1.58,.19],[-.12,1.18,.3],.055,.065,materials.white,figure);
  mesh(new THREE.CylinderGeometry(.375,.375,.145,48), materials.red,[0,.91,0],[1,1,.7],figure);
  ellipsoid(materials.red,[.25,.91,.25],[.14,.11,.08],figure);
  const sash = new THREE.Group(); sash.position.set(.25,.87,.2); figure.add(sash);
  cord([[0,0,0],[.25,-.12,.02],[.49,-.18,-.12],[.77,-.12,-.36]],.052,materials.red,sash);
  cord([[0,0,0],[.18,-.23,.04],[.45,-.28,-.08],[.63,-.23,-.3]],.045,materials.red,sash);
  segment([-.34,1.45,0],[-.67,1.10,.23],.21,.25,materials.robe,figure);
  segment([-.66,1.1,.23],[-.47,1.03,.58],.2,.16,materials.robe,figure);
  segment([.35,1.45,0],[.68,1.21,.12],.21,.25,materials.robe,figure);
  segment([.68,1.21,.12],[.76,1.47,.4],.17,.15,materials.robe,figure);
  ellipsoid(materials.skin,[-.46,1.02,.62],[.12,.12,.12],figure);
  ellipsoid(materials.skin,[.76,1.49,.43],[.12,.13,.12],figure);
  segment([.79,.10,.45],[.79,2.25,.45],.045,.055,materials.wood,figure);
  segment([.79,2.13,.45],[.79,2.25,.45],.055,.055,materials.gold,figure);
  ellipsoid(materials.skin,[0,1.65,.015],[.13,.19,.13],figure);
  const head = new THREE.Group(); head.position.set(-.02,1.99,.02); figure.add(head);
  ellipsoid(materials.skin,[0,0,0],[.36,.40,.33],head);
  ellipsoid(materials.hair,[0,.12,-.045],[.37,.34,.32],head);
  // Exposed face sits forward of the swept hair shell.
  ellipsoid(materials.skin,[0,-.045,.12],[.325,.31,.25],head);
  ellipsoid(materials.skin,[-.355,-.04,.015],[.075,.11,.075],head);
  ellipsoid(materials.skin,[.355,-.04,.015],[.075,.11,.075],head);
  ellipsoid(materials.hair,[.03,.43,-.1],[.14,.16,.14],head);
  const band = mesh(new THREE.CylinderGeometry(.372,.372,.115,48,1,true), materials.red,[0,.15,0],[1,1,.88],head);
  band.rotation.z = -.04;
  cord([[-.21,.22,.25],[-.08,.27,.32],[.07,.22,.32],[.23,.14,.28]],.07,materials.hair,head);
  const headband = new THREE.Group(); headband.position.set(-.32,.12,-.09); head.add(headband);
  cord([[0,0,0],[-.24,-.1,-.2],[-.46,-.05,-.4],[-.74,.1,-.5]],.045,materials.red,headband);
  cord([[0,0,0],[-.26,-.23,-.12],[-.53,-.23,-.32],[-.71,-.15,-.50]],.04,materials.red,headband);
  for (const x of [-.13,.13]) {
    ellipsoid(materials.hair,[x,-.015,.354],[.026,.035,.017],head);
    cord([[x-.055,.065,.333],[x,.08,.35],[x+.05,.065,.333]],.016,materials.hair,head);
  }
  ellipsoid(materials.skin,[0,-.10,.365],[.055,.065,.055],head);
  cord([[-.075,-.19,.325],[0,-.21,.35],[.08,-.18,.325]],.012,materials.wood,head);
  return {
    root,
    setMapPose(active) { figure.rotation.x = active ? -THREE.MathUtils.degToRad(52) : 0; },
    lookAtViewer(active) { head.rotation.y = active ? .1 : 0; },
    setColor(color) { materials.robe.color.set(color); },
    animate(time) { sash.rotation.y = Math.sin(time*1.9)*.08; headband.rotation.y = Math.sin(time*1.5)*.09; mount.rotation.z = Math.sin(time*.65)*.015; },
    anchors: { cloud: new THREE.Vector3(-1.1,.4,.2), hero: new THREE.Vector3(.12,2.5,.12), outfit: new THREE.Vector3(.55,1.5,.35) }
  };
}
