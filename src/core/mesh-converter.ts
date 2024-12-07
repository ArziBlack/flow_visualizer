import * as THREE from "three";

class MeshConverter {
  /**
   * Converts a surface mesh into a volumetric mesh using voxelization.
   * @param geometry - The input surface geometry.
   * @param resolution - The number of voxels along each axis.
   * @returns A volumetric representation as a new THREE.BufferGeometry.
   */
  static convertToVolumetricMesh(
    geometry: THREE.BufferGeometry,
    resolution: number = 10
  ): THREE.BufferGeometry {
    // convert surface mesh to volumetric representation
    const boundingBox = new THREE.Box3().setFromBufferAttribute(
      geometry.getAttribute("position") as THREE.BufferAttribute
    );
    // voxelization or terahedral meshing
    const voxelSize = boundingBox
      .getSize(new THREE.Vector3())
      .divideScalar(resolution);

    const voxelPositions = [];
    for (let x = boundingBox.min.x; x < boundingBox.max.x; x += voxelSize.x) {
      for (let y = boundingBox.min.y; y < boundingBox.max.y; y += voxelSize.y) {
        for (
          let z = boundingBox.min.z;
          z < boundingBox.max.z;
          z += voxelSize.z
        ) {
          voxelPositions.push(x, y, z);
        }
      }
    }
    // placholder implementation
    const volumetricGeometry = new THREE.BufferGeometry();
    volumetricGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(voxelPositions, 3)
    );

    return volumetricGeometry;
  }

  static extractBoundingVolume(model: THREE.Object3D): THREE.Box3 {
    return new THREE.Box3().setFromObject(model);
  }
}

export default MeshConverter;
