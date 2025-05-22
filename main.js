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

  const pos = {
    x: 726.5122207535669,
    y: 551.71838527523,
    z: 216.50118214403489,
  };
  camera.position.z = pos.z;
  camera.position.y = pos.y;
  camera.position.x = pos.x;

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
    innerRadius: 0,
    outerRadius: 20,
    fillColor: new THREE.Color(1, 1, 0),
  };
  circleSweepPass = new CircleSweepPass(scene, camera, options);
  composer.addPass(circleSweepPass);

  controls = new OrbitControls(camera, renderer.domElement);

  const target = {
    x: 28.863136189017375,
    y: -94.07561243936142,
    z: 134.11084727147366,
  };
  window._controls = controls;
  controls.target.set(target.x, target.y, target.z);
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
  let scale = 500000;

  data.features.forEach((d) => {
    // 忽略面积小的建筑
    if (d.properties.area < 1000) {
      return;
    }
    if (!centerPos) {
      // 计算所有建筑的所有点的经纬度平均值作为中心
      let allLng = [],
        allLat = [];
      data.features.forEach((f) => {
        if (f.properties.area < 1000) return;
        let coords = f.geometry.coordinates;
        coords.forEach((ring) => {
          ring.forEach((pt) => {
            allLng.push(pt[0]);
            allLat.push(pt[1]);
          });
        });
      });
      let avgLng = allLng.reduce((a, b) => a + b, 0) / allLng.length;
      let avgLat = allLat.reduce((a, b) => a + b, 0) / allLat.length;
      centerPos = d3geo.geoMercator().scale(scale)([avgLng, avgLat]);
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

    // 分布式高度策略 - 平衡版本（真实感 + 可见度）
    let rand = Math.random();
    let height;

    if (rand < 0.02) {
      // 2% 极高摩天大楼 - 明亮的地标建筑
      height = 4 + Math.random() * 6;
    } else if (rand < 0.12) {
      // 10% 高层楼 - 中等亮度
      height = 2 + Math.random() * 2; /* 2~4 */
    } else {
      // 其余为普通楼 - 适中亮度，有些窗户灯光
      height = 0.2 + Math.random() * 0.8; /* 0.2~1 */
    }

    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: height * 10,
      bevelEnabled: false,
    });

    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshPhongMaterial()
    );
    mesh.rotateX(-Math.PI / 2);
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

  // 用时间周期控制sweep动画
  const period = 2.0; // sweep一圈的秒数
  const maxRadius = 500;
  const minRadius = 0;
  const now = clock.getElapsedTime();
  const t = (now % period) / period; // 0~1
  const sweepWidth = 20; // 圆环宽度
  circleSweepPass.depthMaterial.uniforms.innerRadius.value = minRadius + t * (maxRadius - sweepWidth);
  circleSweepPass.depthMaterial.uniforms.outerRadius.value = circleSweepPass.depthMaterial.uniforms.innerRadius.value + sweepWidth;

  controls.update();

  composer.render();

  requestAnimationFrame(render);
}

requestAnimationFrame(render);
