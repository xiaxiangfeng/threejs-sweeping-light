import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import data from "./aomen.js";
import d3geo from "./d3-geo.min.js";
import { CircleSweepPass } from "./CircleSweepPass.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

let scene;
let renderer;
let camera;
let controls;
let canvas = document.getElementById("c");
let material;
let time = 0;
let composer;
let circleSweepPass;
let clock = new THREE.Clock();

init();

function init() {
  renderer = new THREE.WebGLRenderer({ antialias: true, canvas, alpha: true });

  //

  camera = new THREE.PerspectiveCamera(
    45,
    canvas.innerWidth / canvas.innerHeight,
    1,
    10000
  );
  camera.position.z = 142.98885903220912;
  camera.position.x = -78.49353113009352;
  camera.position.y = 52.49565936245603;

  window._camera = camera;

  scene = new THREE.Scene();
  scene.background = new THREE.Color("black");

  let directionalLight = new THREE.DirectionalLight(0xffffff, 2);
  directionalLight.position.set(800, 400, 600);
  scene.add(directionalLight);

  let directionalLight2 = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight2.position.set(-400, -200, -300);
  scene.add(directionalLight2);

  let ambient = new THREE.AmbientLight(0xffffff, 1);
  scene.add(ambient);

  // postprocessing

  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  let composerScale = window.devicePixelRatio * 2;
  composer.setSize(
    window.innerWidth * composerScale,
    window.innerHeight * composerScale
  );

  var options = {
    center: new THREE.Vector3(0, 0, 0),
    innerRadius: 1000,
    outerRadius: 2000,
    fillColor: new THREE.Color(1, 1, 0),
  };
  circleSweepPass = new CircleSweepPass(scene, camera, options);
  composer.addPass(circleSweepPass);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.update();
  controls.enablePan = true;
  controls.enableDamping = true;

  const gridHelper = new THREE.GridHelper(2000, 200, 0x808080, 0x808080);
  gridHelper.position.y = 0;
  gridHelper.position.x = 0;
  scene.add(gridHelper);

  const axesHelper = new THREE.AxesHelper(5);
  scene.add(axesHelper);

  let centerPos;
  let scale = 10000;

  function generateRandomNumber() {
    let random = Math.random();
    if (random < 0.5) {
      // 50% chance to be between 0.2 and 0.3
      return 0.2 + random * 0.1;
    } else if (random < 0.8) {
      // 30% chance to be between 0.3 and 0.5
      return 0.3 + random * 0.2;
    } else {
      // Remaining 20% chance to be between 0.1 and 0.2
      return 0.1 + random * 0.1;
    }
  }

  data.features.forEach((d) => {
    // 忽略面积小的建筑
    if (d.properties.area < 1000) {
      return;
    }
    if (!centerPos) {
      let center = d.geometry.coordinates[0][0];
      centerPos = d3geo.geoMercator().scale(scale)([center[0], center[1]]);
    }

    let coords = d.geometry.coordinates;
    let shape;
    for (let i = 0; i < coords.length; i++) {
      if (i === 0) {
        shape = new THREE.Shape(buildPoints(coords[0], coords[0]));
      } else {
        shape.holes.push(new THREE.Path(buildPoints(coords[i], coords[0])));
      }
    }
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: generateRandomNumber(),
      bevelEnabled: false,
    });

    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshPhongMaterial({ color: "#00BCD4" })
    );
    mesh.rotateX(-Math.PI / 2);
    mesh.scale.setScalar(50);
    mesh.scale.setZ(20);
    scene.add(mesh);
  });

  function buildPoints(coords) {
    const points = [];
    for (let i = 0; i < coords.length; i++) {
      let pos = d3geo.geoMercator().scale(scale)([coords[i][0], coords[i][1]]);
      points.push(
        new THREE.Vector2(pos[0] - centerPos[0], -(pos[1] - centerPos[1]))
      );
    }
    return points;
  }
}

function resizeRendererToDisplaySize(renderer) {
  const canvas = renderer.domElement;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const needResize = canvas.width !== width || canvas.height !== height;
  if (needResize) {
    renderer.setSize(width, height, false);
  }

  return needResize;
}

function render() {
  if (resizeRendererToDisplaySize(renderer)) {
    const canvas = renderer.domElement;
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
  }
  const T = clock.getDelta();

  circleSweepPass.depthMaterial.uniforms.innerRadius.value += 20 * T;
  circleSweepPass.depthMaterial.uniforms.outerRadius.value += 20 * T;
  if (circleSweepPass.depthMaterial.uniforms.innerRadius.value > 100) {
    circleSweepPass.depthMaterial.uniforms.innerRadius.value = 0;
    circleSweepPass.depthMaterial.uniforms.outerRadius.value = 1;
  }

  controls.update();

  composer.render();

  requestAnimationFrame(render);
}

requestAnimationFrame(render);
