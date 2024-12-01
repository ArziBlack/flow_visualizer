import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
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
      case ".step":
      case ".stp":
        return this.importSTEP(filePath, options);
      case ".iges":
      case ".igs":
        return this.importIGES(filePath, options);
      default:
        throw new Error(`unsupported file format ${extension}`);
    }
  }

  private async importSTL(
    filePath: string,
    options: CADModelImportOptions
  ): Promise<THREE.Mesh> {}

  private async importOBJ(
    filePath: string,
    options: CADModelImportOptions
  ): Promise<THREE.Object3D> {}

  private async importGLTF(
    filePath: string,
    options: CADModelImportOptions
  ): Promise<THREE.Object3D> {}

  private async importSTEP(
    filePath: string,
    options: CADModelImportOptions
  ): Promise<THREE.Object3D> {}

  private async importIGES(
    filePath: string,
    options: CADModelImportOptions
  ): Promise<THREE.Object3D> {}

  private getFileExtension(filePath: string): string {
    return filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
  }
}

export default ModelImporter;
