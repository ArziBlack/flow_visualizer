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

class ModelImporter {
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
    "ies",
  ];

  async importModel(
    filePath: string,
    options: CADModelImportOptions = {}
  ): Promise<THREE.Object3D> {
    const extension = this.getFileExtension(filePath);

    switch (extension.toLowerCase()) {
      case ".stl":
        return this.importSTL(filePath, options);
      case ".obj":
        return this.importOBJ(filePath, options);
      case ".gltf":
      case ".glb":
        return this.importGLTF(filePath, options);
      case ".vtk":
        return this.importVTK(filePath, options);
      case ".ies":
        return this.importIES(filePath, options);
      default:
        throw new Error(`unsupported file format ${extension}`);
    }
  }

  private async importSTL(
    filePath: string,
    options: CADModelImportOptions
  ): Promise<THREE.Mesh> {
    const loader = new STLLoader();
    const geometry = await loader.loadAsync(filePath);
    const material = new THREE.MeshStandardMaterial({ color: 0x888888 });
    const mesh = new THREE.Mesh(geometry, material);

    this.processMesh(mesh, options);
    return mesh;
  }

  private async importOBJ(
    filePath: string,
    options: CADModelImportOptions
  ): Promise<THREE.Object3D> {
    const loader = new OBJLoader();
    const object = await loader.loadAsync(filePath);

    this.preprocessObject(object, options);
    return object;
  }

  private async importGLTF(
    filePath: string,
    options: CADModelImportOptions
  ): Promise<THREE.Object3D> {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(filePath);

    this.preprocessObject(gltf.scene, options);
    return gltf.scene;
  }

  private async importVTK(
    filePath: string,
    options: CADModelImportOptions
  ): Promise<THREE.Object3D> {
    const loader = new VTKLoader();
    const geometry = await loader.loadAsync(filePath);
    const material = new THREE.MeshStandardMaterial({
      color: 0x888888,
      wireframe: false,
    });
    const mesh = new THREE.Mesh(geometry, material);

    this.processMesh(mesh, options);
    return mesh;
  }

  private async importIES(
    filePath: string,
    options: CADModelImportOptions
  ): Promise<THREE.Object3D> {
    const loader = new IESLoader();
    const iesTexture = await loader.loadAsync(filePath);

    const light = new THREE.SpotLight(0xffffff, 1);
    light.angle = Math.PI / 6; // Adjust angle as needed
    light.decay = 2;
    light.distance = 100;
    light.intensity = 10;

    // Apply the IES texture to the light
    light.map = iesTexture;

    return light;
  }

  private getFileExtension(filePath: string): string {
    return filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
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
