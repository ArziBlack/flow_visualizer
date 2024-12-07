import * as THREE from "three";
import { vec3 } from "gl-matrix";

interface SPHParticle {
  position: vec3;
  velocity: vec3;
  density: number;
  pressure: number;
}

interface SimulationParameters {
  bounds: THREE.Box3;
  viscosity: number;
  density: number;
  flowRate: number;
  timeStep: number;
}

export interface SimulationConfig extends SimulationParameters {
  bounds: THREE.Box3;
}

export class SPHSimulator {
  private particles: SPHParticle[] = [];
  private boundingGeometry: THREE.Object3D;

  private simulationParams = {
    kernelRadius: 0.1,
    restDensity: 1000,
    viscosityCoefficient: 0.1,
    pressureCoefficient: 50,
  };

  constructor(params: SimulationParameters) {
    // Create a box mesh from the bounds
    const geometry = new THREE.BoxGeometry(
      params.bounds.max.x - params.bounds.min.x,
      params.bounds.max.y - params.bounds.min.y,
      params.bounds.max.z - params.bounds.min.z
    );
    this.boundingGeometry = new THREE.Mesh(geometry);
    this.boundingGeometry.position.copy(
      params.bounds.getCenter(new THREE.Vector3())
    );

    // Initialize simulation parameters
    this.setSimulationParameters(params);
  }

  public setSimulationParameters(params: SimulationParameters): void {
    this.simulationParams = {
      ...this.simulationParams,
      restDensity: params.density,
      viscosityCoefficient: params.viscosity,
      pressureCoefficient: params.flowRate * 50, // Scale flow rate to pressure
    };
  }

  public step(deltaTime: number): void {
    this.calculateDensity();
    this.calculatePressure();
    this.applyForces(deltaTime);
    this.updatePositions(deltaTime);
  }

  public resetSimulation(): void {
    // Reset all particles to their initial positions
    const bounds = new THREE.Box3().setFromObject(this.boundingGeometry);
    this.particles = [];
    this.initializeParticles(bounds, this.simulationParams.kernelRadius);
  }

  public getParticlePositions(): vec3[] {
    return this.particles.map((particle) => particle.position);
  }

  public getParticleVelocities(): vec3[] {
    return this.particles.map((particle) => particle.velocity);
  }

  public initializeParticles(
    startVolume: THREE.Box3,
    particleSpacing: number
  ): void {
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
        if (particle !== other_particle) {
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
              viscosityForce,
              viscosityForce,
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
      (particle1.pressure + particle2.pressure) / (2 * particle2.density);
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
    vec3.sub(force, particle2.velocity, particle1.velocity);
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
    const bounds = new THREE.Box3().setFromObject(this.boundingGeometry);

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
}
