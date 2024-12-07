// src/utils/visualization.ts

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { GeometryUtils } from "./geometry-utils";
import { vec3 } from "gl-matrix";

export class Visualizer {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private particles: THREE.Points | null = null;
  private model: THREE.Object3D | null = null;

  constructor(container: HTMLElement) {
    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a1a);

    // Camera setup
    this.camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.set(5, 5, 5);

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(this.renderer.domElement);

    // Controls setup
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;

    // Lighting setup
    this.setupLighting();

    // Window resize handler
    window.addEventListener("resize", () => this.handleResize(container));

    // Start animation loop
    this.animate();
  }

  private setupLighting(): void {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 10);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
    hemiLight.position.set(0, 20, 0);

    this.scene.add(ambientLight, directionalLight, hemiLight);
  }

  private handleResize(container: HTMLElement): void {
    this.camera.aspect = container.clientWidth / container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(container.clientWidth, container.clientHeight);
  }

  public setModel(model: THREE.Object3D): void {
    if (this.model) {
      this.scene.remove(this.model);
    }

    this.model = model;

    // Create the material we want to apply
    const material = new THREE.MeshPhongMaterial({
      color: 0x156289,
      transparent: true,
      opacity: 0.7,
      wireframe: false,
    });

    // Traverse the model and apply material to all meshes
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = material;
      }
    });

    this.scene.add(model);

    // Center camera on model
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    this.controls.target.copy(center);
    this.camera.lookAt(center);
  }

  public updateModelOpacity(opacity: number): void {
    if (this.model) {
      this.model.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          if (child.material instanceof THREE.Material) {
            child.material.transparent = true;
            child.material.opacity = opacity;
            child.material.needsUpdate = true;
          }
        }
      });
    }
  }

  public updateParticleSize(size: number): void {
    if (this.particles) {
      (this.particles.material as THREE.PointsMaterial).size = size;
    }
  }

  public updateParticles(positions: vec3[], velocities?: vec3[]): void {
    const geometry = new THREE.BufferGeometry();
    const positionArray = new Float32Array(positions.length * 3);
    const colors = new Float32Array(positions.length * 3);

    positions.forEach((pos, i) => {
      positionArray[i * 3] = pos[0];
      positionArray[i * 3 + 1] = pos[1];
      positionArray[i * 3 + 2] = pos[2];

      // Color based on velocity if available
      if (velocities) {
        const velocity = velocities[i];
        const speed = Math.sqrt(
          velocity[0] * velocity[0] +
            velocity[1] * velocity[1] +
            velocity[2] * velocity[2]
        );
        const hue = Math.min(speed / 10, 1); // Normalize speed to 0-1
        const color = new THREE.Color().setHSL(hue, 1, 0.5);
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
      }
    });

    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positionArray, 3)
    );

    if (velocities) {
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    }

    if (this.particles) {
      this.scene.remove(this.particles);
    }

    const material = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: !!velocities,
      color: velocities ? undefined : 0x00ff00,
    });

    this.particles = new THREE.Points(geometry, material);
    this.scene.add(this.particles);
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  public setParticleSize(size: number): void {
    if (this.particles) {
      (this.particles.material as THREE.PointsMaterial).size = size;
    }
  }

  public getCameraPosition(): THREE.Vector3 {
    return this.camera.position.clone();
  }

  public getControls(): OrbitControls {
    return this.controls;
  }
}
