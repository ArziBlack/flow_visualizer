import * as THREE from "three";
import { vec3 } from "gl-matrix";

interface SPHParticle {
  position: vec3;
  velocity: vec3;
  density: number;
  pressure: number;
}

class SPHSimulator {
  private particles: SPHParticle[] = [];
  private boundingGeometry: THREE.Object3D;

  private simulationParams = {
    kernelRadius: 0.1,
    restDensity: 1000,
    viscosityCoefficient: 0.1,
    pressureCoefficient: 50,
  };

  constructor(boundingGeometry: THREE.Object3D) {
    this.boundingGeometry = boundingGeometry;
  }

  initializeParticles(startVolume: THREE.Box3, particleSpacing: number): void {
    const min = startVolume.min;
    const max = startVolume.max;

    for (let x = min.x; x < max.x; x += particleSpacing) {
      for (let y = min.y; y < max.y; y += particleSpacing) {
        for (let z = min.z; z < max.z; z += particleSpacing) {
          this.particles.push({
            position: vec3.fromValues(x, y, z),
            velocity: vec3.create(),
            density: this.simulationParams.restDensity,
            pressure: 0,
          });
        }
      }
    }
  }

  private calculateDensity(): void {
    this.particles.forEach((particle) => {
      let density = 0;

      this.particles.forEach((other_particle) => {
        const distance = vec3.distance(
          particle.position,
          other_particle.position
        );

        if (distance < this.simulationParams.kernelRadius) {
          //   Kernel function (eg, Poly6 kernel)
          density += this.poly6Kernel(distance);
        }
      });
      particle.density = density;
    });
  }

  private poly6Kernel(distance: number): number {
    const h = this.simulationParams.kernelRadius;
    const value =
      (315 / (64 * Math.PI * Math.pow(h, 9))) *
      Math.pow(h * h - distance * distance, 3);

    return Math.max(0, value);
  }

  simulate(deltaTime: number): void {
    this.calculateDensity();
    this.calculatePressure();
    this.applyForces(deltaTime);
    this.updatePositions(deltaTime);
  }

  private calculatePressure(): void {
    this.particles.forEach((particle) => {
      particle.pressure =
        this.simulationParams.pressureCoefficient *
        (particle.density - this.simulationParams.restDensity);
    });
  }

  private applyForces(deltaTime: number): void {
    this.particles.forEach((particle) => {
      const pressureForce = vec3.create();
      const viscosityForce = vec3.create();

      this.particles.forEach((other_particle) => {
        if (particle != other_particle) {
          const distance = vec3.distance(
            particle.position,
            other_particle.position
          );

          if (distance < this.simulationParams.kernelRadius) {
            vec3.add(
              pressureForce,
              pressureForce,
              this.calculatePressureForce(particle, other_particle)
            );

            vec3.add(
              pressureForce,
              pressureForce,
              this.calculateViscosityForce(particle, other_particle)
            );
          }
        }
      });

      vec3.scale(pressureForce, pressureForce, deltaTime);
      vec3.scale(
        viscosityForce,
        viscosityForce,
        this.simulationParams.viscosityCoefficient * deltaTime
      );
      vec3.add(particle.velocity, particle.velocity, pressureForce);
      vec3.add(particle.velocity, particle.velocity, viscosityForce);
    });
  }

  private calculatePressureForce(
    particle1: SPHParticle,
    particle2: SPHParticle
  ): vec3 {
    const force = vec3.create();
    const distance = vec3.distance(particle1.position, particle2.position);

    const pressureTerm =
      (particle1.pressure + particle2.pressure) / (2 * particle2.pressure);
    vec3.scale(
      force,
      vec3.sub(vec3.create(), particle2.position, particle1.position),
      pressureTerm
    );
    return force;
  }

  private calculateViscosityForce(
    particle1: SPHParticle,
    particle2: SPHParticle
  ): vec3 {
    const force = vec3.create();

    vec3.sub(force, particle1.velocity, particle2.velocity);
    return force;
  }

  private updatePositions(deltaTime: number): void {
    this.particles.forEach((particle) => {
      vec3.scaleAndAdd(
        particle.position,
        particle.position,
        particle.velocity,
        deltaTime
      );

      this.handleBoundaryCollision(particle);
    });
  }

  private handleBoundaryCollision(particle: SPHParticle): void {
    const bounds: THREE.Box3 = new THREE.Box3().setFromObject(
      this.boundingGeometry
    );

    ["x", "y", "z"].forEach((axis, index) => {
      if (particle.position[index] < bounds.min.getComponent(index)) {
        particle.position[index] = bounds.min.getComponent(index);
        particle.velocity[index] *= -0.5;
      }
      if (particle.position[index] > bounds.max.getComponent(index)) {
        particle.position[index] = bounds.max.getComponent(index);
        particle.velocity[index] *= -0.5;
      }
    });
  }

  getParticles(): SPHParticle[] {
    return this.particles;
  }
}
