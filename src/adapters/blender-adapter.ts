import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

export class BlenderAdapter {
  async importModel(file: File): Promise<THREE.Object3D> {
    return new Promise((resolve, reject) => {
      // Assuming Blender export to GLTF
      const loader = new GLTFLoader();
      const url = URL.createObjectURL(file);

      loader.load(
        url,
        (gltf) => {
          URL.revokeObjectURL(url);
          resolve(gltf.scene);
        },
        undefined,
        (error) => {
          URL.revokeObjectURL(url);
          console.log(error);
          reject(new Error(`Failed to import Blender model`));
        }
      );
    });
  }
}
