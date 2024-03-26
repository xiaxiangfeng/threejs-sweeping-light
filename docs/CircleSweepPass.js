import * as THREE from "three";
import { Pass, FullScreenQuad } from "three/addons/postprocessing/Pass.js";

class CircleSweepPass extends Pass {
  constructor(scene, camera, options) {
    super();
    this.scene = scene;
    this.camera = camera;
    options = options ? options : {};
    this.center = options.center ? options.center : new THREE.Vector3(0, 0, 0);
    this.innerRadius = options.innerRadius ? options.innerRadius : 0;
    this.outerRadius = options.outerRadius ? options.outerRadius : 0;
    this.fillColor = options.fillColor
      ? options.fillColor
      : new THREE.Color(1, 1, 1);

    this.depthTarget = new THREE.WebGLRenderTarget(
      window.innerWidth,
      window.innerHeight
    );
    this.depthTarget.texture.format = THREE.RGBAFormat;
    this.depthTarget.texture.minFilter = THREE.NearestFilter;
    this.depthTarget.texture.magFilter = THREE.NearestFilter;
    this.depthTarget.texture.generateMipmaps = false;
    this.depthTarget.stencilBuffer = false;
    this.depthTarget.depthBuffer = true;
    this.depthTarget.depthTexture = new THREE.DepthTexture();
    this.depthTarget.depthTexture.type = THREE.UnsignedShortType;

    this.depthMaterial = this.getDepthMaterial();

    this.depthMaterial.uniforms["fillColor"].value = this.fillColor;

    this.fsQuad = new FullScreenQuad(null);

    this.needsSwap = false;
  }

  render(renderer, writeBuffer, readBuffer, deltaTime, maskActive) {
    this.depthMaterial.uniforms["colorTexture"].value = readBuffer.texture;

    this.fsQuad.material = this.depthMaterial;

    let VPMatrix4x4_inverse = this.camera.projectionMatrixInverse
      .clone()
      .premultiply(this.camera.matrixWorld.clone());
    this.depthMaterial.uniforms.VPMatrix4x4_inverse.value = VPMatrix4x4_inverse;

    renderer.setRenderTarget(this.depthTarget);
    renderer.render(this.scene, this.camera);

    renderer.setRenderTarget(null);

    this.fsQuad.render(renderer);
  }

  getDepthMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: {
        colorTexture: { value: null },
        depthTexture: { value: this.depthTarget.depthTexture },
        center: { value: this.center },
        innerRadius: { value: this.innerRadius },
        outerRadius: { value: this.outerRadius },
        fillColor: { value: null },
        VPMatrix4x4_inverse: { value: null },
      },
      transparent: true,
      vertexShader: `
      precision highp float;
      varying vec2 vUv;
              
      void main() {
        vUv = uv;

        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      }`,
      fragmentShader: `
      #include <packing>
      uniform sampler2D depthTexture;
      uniform sampler2D colorTexture;
      uniform float innerRadius;
      uniform float outerRadius;
      uniform vec3 fillColor;
      varying vec2 vUv;
      uniform mat4 VPMatrix4x4_inverse; // 相机vp矩阵逆
      void main() {
        vec4 diff = texture2D( colorTexture, vUv);
        vec2 vUv_ = (vUv * 2.0) - 1.0;
        float baseDepth = texture2D(depthTexture,vUv).x; // 获取深度纹理
        vec4 ndc = vec4( vUv_.x, vUv_.y, (baseDepth*2.0-1.0), 1.0 );
        vec4 worlDpos = VPMatrix4x4_inverse * ndc;
        worlDpos /= worlDpos.w;
        float mydistance = length(vec3(worlDpos.x,worlDpos.y,worlDpos.z));
        if (mydistance < outerRadius && mydistance > innerRadius) {
          gl_FragColor=vec4(mix(diff.xyz,fillColor,(mydistance-innerRadius)/(outerRadius-innerRadius)-0.2),1.0);
        } else {
          gl_FragColor=diff;
        }
      }  
      `,
    });
  }
}

export { CircleSweepPass };
