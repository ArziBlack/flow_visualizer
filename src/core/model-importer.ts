import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { VTKLoader } from "three/examples/jsm/loaders/VTKLoader";
import { IESLoader } from "three/examples/jsm/loaders/IESLoader";
import * as xml2js from "xml2js";

interface CADModelImportOptions {
  scaleFactor?: number;
  centerModel?: boolean;
}

export class ModelImporter {
  private supportedFormats: string[] = [
    ".stl",
    ".obj",
    ".gltf",
    ".glb",
    ".step",
    ".stp",
    ".iges",
    ".igs",
    ".vtk",
    ".ies",
  ];

  async importModel(
    file: File,
    options: CADModelImportOptions = {}
  ): Promise<THREE.Object3D> {
    const extension = this.getFileExtension(file.name);
    const url = URL.createObjectURL(file);

    try {
      switch (extension.toLowerCase()) {
        case ".stl":
          return await this.importSTL(url, options);
        case ".obj":
          return await this.importOBJ(url, options);
        case ".gltf":
        case ".glb":
          return await this.importGLTF(url, options);
        case ".vtk":
          return await this.importVTK(url, options);
        case ".ies":
          return await this.importIES(url, options);
        default:
          throw new Error(`Unsupported file format ${extension}`);
      }
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  private async importSTL(
    url: string,
    options: CADModelImportOptions
  ): Promise<THREE.Mesh> {
    const loader = new STLLoader();
    const geometry = await loader.loadAsync(url);
    const material = new THREE.MeshStandardMaterial({ color: 0x888888 });
    const mesh = new THREE.Mesh(geometry, material);

    this.processMesh(mesh, options);
    return mesh;
  }

  private async importOBJ(
    url: string,
    options: CADModelImportOptions
  ): Promise<THREE.Object3D> {
    const loader = new OBJLoader();
    const object = await loader.loadAsync(url);

    this.preprocessObject(object, options);
    return object;
  }

  private async importGLTF(
    url: string,
    options: CADModelImportOptions
  ): Promise<THREE.Object3D> {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(url);

    this.preprocessObject(gltf.scene, options);
    return gltf.scene;
  }

  private async importVTK(
    url: string,
    options: CADModelImportOptions
  ): Promise<THREE.Object3D> {
    const loader = new VTKLoader();
    const geometry = await loader.loadAsync(url);
    const material = new THREE.MeshStandardMaterial({
      color: 0x888888,
      wireframe: false,
    });
    const mesh = new THREE.Mesh(geometry, material);

    this.processMesh(mesh, options);
    return mesh;
  }

  private async importIES(
    url: string,
    options: CADModelImportOptions
  ): Promise<THREE.Object3D> {
    const loader = new IESLoader();
    const iesTexture = await loader.loadAsync(url);

    const light = new THREE.SpotLight(0xffffff, 1);
    light.angle = Math.PI / 6;
    light.decay = 2;
    light.distance = 100;
    light.intensity = 10;

    // Apply the IES texture to the light
    light.map = iesTexture;

    return light;
  }

  private getFileExtension(filename: string): string {
    return filename.slice(filename.lastIndexOf(".")).toLowerCase();
  }

  private processMesh(mesh: THREE.Mesh, options: CADModelImportOptions): void {
    const { scaleFactor = 1, centerModel = true } = options;

    mesh.scale.multiplyScalar(scaleFactor);

    if (centerModel) {
      mesh.geometry.center();
    }
  }

  private preprocessObject(
    object: THREE.Object3D,
    options: CADModelImportOptions
  ): void {
    const { scaleFactor = 1, centerModel = true } = options;

    object.scale.multiplyScalar(scaleFactor);

    if (centerModel) {
      const box = new THREE.Box3().setFromObject(object);
      const center = box.getCenter(new THREE.Vector3());
      object.position.sub(center);
    }
  }
}

export default ModelImporter;
