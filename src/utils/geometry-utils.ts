import * as THREE from "three";
import { vec3 } from "gl-matrix";

export class GeometryUtils {
  /**
   * Calculate bounding box for a given geometry
   */
  static calculateBoundingBox(geometry: THREE.BufferGeometry): THREE.Box3 {
    geometry.computeBoundingBox();
    return geometry.boundingBox || new THREE.Box3();
  }

  /**
   * Calculate pipe cross-section area at a given point
   */
  static calculatePipeCrossSection(
    geometry: THREE.BufferGeometry,
    position: THREE.Vector3,
    direction: THREE.Vector3
  ): number {
    // Create a plane at the position perpendicular to flow direction
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      direction.normalize(),
      position
    );

    // Get intersection points of geometry with plane
    const intersectionPoints: THREE.Vector3[] = [];
    const positions = geometry.attributes.position;

    for (let i = 0; i < positions.count; i += 3) {
      const triangle = new THREE.Triangle(
        new THREE.Vector3().fromBufferAttribute(positions, i),
        new THREE.Vector3().fromBufferAttribute(positions, i + 1),
        new THREE.Vector3().fromBufferAttribute(positions, i + 2)
      );

      // Check triangle intersection with plane
      const intersection = this.trianglePlaneIntersection(triangle, plane);
      if (intersection) {
        intersectionPoints.push(...intersection);
      }
    }

    // Calculate area from intersection points
    return this.calculateAreaFromPoints(intersectionPoints);
  }

  /**
   * Find intersection points between a triangle and a plane
   */
  private static trianglePlaneIntersection(
    triangle: THREE.Triangle,
    plane: THREE.Plane
  ): THREE.Vector3[] | null {
    const points: THREE.Vector3[] = [];
    const edges = [
      [triangle.a, triangle.b],
      [triangle.b, triangle.c],
      [triangle.c, triangle.a],
    ];

    edges.forEach(([start, end]) => {
      const line = new THREE.Line3(start, end);
      const intersection = new THREE.Vector3();
      if (plane.intersectLine(line, intersection)) {
        points.push(intersection);
      }
    });

    return points.length > 0 ? points : null;
  }

  /**
   * Calculate area from a set of coplanar points (cross-section)
   */
  private static calculateAreaFromPoints(points: THREE.Vector3[]): number {
    if (points.length < 3) return 0;

    // Use triangulation to calculate area
    let area = 0;
    const center = new THREE.Vector3();
    points.forEach((p) => center.add(p));
    center.divideScalar(points.length);

    for (let i = 0; i < points.length; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % points.length];
      const triangle = new THREE.Triangle(center, p1, p2);
      area += triangle.getArea();
    }

    return area;
  }

  /**
   * Check if a point is inside the pipe geometry
   */
  static isPointInsidePipe(
    point: vec3,
    geometry: THREE.BufferGeometry,
    threshold: number = 0.001
  ): boolean {
    // Ray casting algorithm for point-in-mesh test
    const raycaster = new THREE.Raycaster();
    const direction = new THREE.Vector3(1, 0, 0); // Cast ray in x direction
    const position = new THREE.Vector3(point[0], point[1], point[2]);

    raycaster.set(position, direction);
    const intersects = raycaster.intersectObject(
      new THREE.Mesh(geometry),
      false
    );

    // If number of intersections is odd, point is inside
    return intersects.length % 2 === 1;
  }

  /**
   * Generate sampling points inside the pipe for particle initialization
   */
  static generateSamplingPoints(
    geometry: THREE.BufferGeometry,
    spacing: number
  ): vec3[] {
    const points: vec3[] = [];
    const boundingBox = this.calculateBoundingBox(geometry);

    // Create grid of points within bounding box
    for (let x = boundingBox.min.x; x <= boundingBox.max.x; x += spacing) {
      for (let y = boundingBox.min.y; y <= boundingBox.max.y; y += spacing) {
        for (let z = boundingBox.min.z; z <= boundingBox.max.z; z += spacing) {
          const point = vec3.fromValues(x, y, z);
          if (this.isPointInsidePipe(point, geometry)) {
            points.push(point);
          }
        }
      }
    }

    return points;
  }

  /**
   * Calculate flow direction at a given point
   */
  static calculateFlowDirection(
    geometry: THREE.BufferGeometry,
    point: vec3,
    searchRadius: number = 0.1
  ): vec3 {
    // Find nearby vertices
    const positions = geometry.attributes.position;
    const nearbyPoints: THREE.Vector3[] = [];

    for (let i = 0; i < positions.count; i++) {
      const vertex = new THREE.Vector3().fromBufferAttribute(positions, i);
      const distance = vertex.distanceTo(
        new THREE.Vector3(point[0], point[1], point[2])
      );

      if (distance < searchRadius) {
        nearbyPoints.push(vertex);
      }
    }

    // Calculate average direction using PCA
    if (nearbyPoints.length < 2) {
      return vec3.fromValues(1, 0, 0); // Default direction
    }

    const direction = this.calculatePrincipalDirection(nearbyPoints);
    return vec3.fromValues(direction.x, direction.y, direction.z);
  }

  /**
   * Calculate principal direction using PCA
   */
  private static calculatePrincipalDirection(
    points: THREE.Vector3[]
  ): THREE.Vector3 {
    // Calculate centroid
    const centroid = new THREE.Vector3();
    points.forEach((p) => centroid.add(p));
    centroid.divideScalar(points.length);

    // Build covariance matrix
    const covariance = new THREE.Matrix3();
    points.forEach((p) => {
      const diff = p.clone().sub(centroid);
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          covariance.elements[i * 3 + j] +=
            diff.getComponent(i) * diff.getComponent(j);
        }
      }
    });

    // Find principal eigenvector (simplified)
    const direction = new THREE.Vector3(
      covariance.elements[0],
      covariance.elements[1],
      covariance.elements[2]
    ).normalize();

    return direction;
  }
}
