import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";

export class AutoCADAdapter {
  async importModel(file: File): Promise<THREE.Object3D> {
    // Assuming AutoCAD export to STL
    return new Promise((resolve, reject) => {
      const loader = new STLLoader();
      const url = URL.createObjectURL(file);

      loader.load(
        url,
        (geometry) => {
          URL.revokeObjectURL(url);
          const material = new THREE.MeshPhongMaterial({
            color: 0xaaaaaa,
            specular: 0x111111,
            shininess: 200,
          });
          const mesh = new THREE.Mesh(geometry, material);
          resolve(mesh);
        },
        undefined,
        (error) => {
          URL.revokeObjectURL(url);
          console.log(error);
          reject(new Error(`Failed to import AutoCAD model`));
        }
      );
    });
  }
}
