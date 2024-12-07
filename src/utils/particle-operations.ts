import { vec3 } from "gl-matrix";

export interface Particle {
  position: vec3;
  velocity: vec3;
  pressure: number;
  density: number;
  mass: number;
}

export class ParticleOperations {
  // SPH Smoothing kernel functions
  static kernelPoly6(r: number, h: number): number {
    if (r > h) return 0;
    const h2 = h * h;
    const h9 = h2 * h2 * h2 * h2 * h;
    return (315.0 / (64.0 * Math.PI * h9)) * Math.pow(h2 - r * r, 3);
  }

  static kernelSpikyGradient(r: vec3, h: number): vec3 {
    const rlen = vec3.length(r);
    if (rlen > h || rlen === 0) return vec3.create();

    const coefficient =
      (-45.0 / (Math.PI * Math.pow(h, 6))) * Math.pow(h - rlen, 2);
    const result = vec3.create();
    return vec3.scale(result, r, coefficient / rlen);
  }

  static calculateDensity(
    particle: Particle,
    neighbors: Particle[],
    smoothingLength: number
  ): number {
    let density = 0;

    neighbors.forEach((neighbor) => {
      const r = vec3.create();
      vec3.subtract(r, particle.position, neighbor.position);
      const rlen = vec3.length(r);

      density += neighbor.mass * this.kernelPoly6(rlen, smoothingLength);
    });

    return density;
  }

  static calculatePressureForce(
    particle: Particle,
    neighbors: Particle[],
    smoothingLength: number,
    gasConstant: number
  ): vec3 {
    const force = vec3.create();

    neighbors.forEach((neighbor) => {
      const r = vec3.create();
      vec3.subtract(r, particle.position, neighbor.position);

      const pressure = gasConstant * (particle.density + neighbor.density);
      const gradientKernel = this.kernelSpikyGradient(r, smoothingLength);

      const scaledForce = vec3.scale(
        vec3.create(),
        gradientKernel,
        (pressure * neighbor.mass) / (2 * neighbor.density)
      );
      vec3.add(force, force, scaledForce);
    });

    return force;
  }

  static calculateViscosityForce(
    particle: Particle,
    neighbors: Particle[],
    smoothingLength: number,
    viscosity: number
  ): vec3 {
    const force = vec3.create();

    neighbors.forEach((neighbor) => {
      const r = vec3.create();
      vec3.subtract(r, particle.position, neighbor.position);
      const rlen = vec3.length(r);

      if (rlen < smoothingLength) {
        const relativeVel = vec3.create();
        vec3.subtract(relativeVel, neighbor.velocity, particle.velocity);

        const kernelValue = this.kernelPoly6(rlen, smoothingLength);
        const viscosityForce = vec3.scale(
          vec3.create(),
          relativeVel,
          (viscosity * neighbor.mass * kernelValue) / neighbor.density
        );

        vec3.add(force, force, viscosityForce);
      }
    });

    return force;
  }

  static updateParticle(
    particle: Particle,
    forces: vec3,
    deltaTime: number,
    bounds: { min: vec3; max: vec3 }
  ): void {
    // Update velocity using forces
    const acceleration = vec3.scale(vec3.create(), forces, 1 / particle.mass);
    vec3.scaleAndAdd(
      particle.velocity,
      particle.velocity,
      acceleration,
      deltaTime
    );

    // Update position using velocity
    vec3.scaleAndAdd(
      particle.position,
      particle.position,
      particle.velocity,
      deltaTime
    );

    // Boundary conditions (simple bounce)
    for (let i = 0; i < 3; i++) {
      if (particle.position[i] < bounds.min[i]) {
        particle.position[i] = bounds.min[i];
        particle.velocity[i] *= -0.5; // Damping factor
      }
      if (particle.position[i] > bounds.max[i]) {
        particle.position[i] = bounds.max[i];
        particle.velocity[i] *= -0.5;
      }
    }
  }

  static findNeighbors(
    particle: Particle,
    allParticles: Particle[],
    searchRadius: number
  ): Particle[] {
    return allParticles.filter((other) => {
      if (other === particle) return false;
      const dist = vec3.distance(particle.position, other.position);
      return dist < searchRadius;
    });
  }
}
