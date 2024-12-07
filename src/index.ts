// src/index.ts

import ModelImporter from "./core/model-importer";
import { SimulationConfig, SPHSimulator } from "./core/sph-simulator";
import { Visualizer } from "./utils/visualizations";
import { GeometryUtils } from "./utils/geometry-utils";
import { ParticleOperations } from "./utils/particle-operations";
import * as THREE from "three";
import { vec3 } from "gl-matrix";

interface FluidProperties {
  viscosity: number;
  density: number;
  flowRate: number;
  timeStep: number;
}

class PipeFlowSimulation {
  private modelImporter: ModelImporter;
  private simulator: SPHSimulator | null = null;
  private visualizer: Visualizer;
  private isSimulating: boolean = false;
  private animationFrameId: number | null = null;
  private model: THREE.Object3D | null = null;

  constructor() {
    this.modelImporter = new ModelImporter();
    this.visualizer = new Visualizer(
      document.getElementById("simulation-container")!
    );
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Model Import
    const modelInput = document.getElementById(
      "model-input"
    ) as HTMLInputElement;
    modelInput.addEventListener("change", this.handleModelImport.bind(this));

    // Simulation Controls
    document
      .getElementById("start-btn")!
      .addEventListener("click", this.startSimulation.bind(this));
    document
      .getElementById("pause-btn")!
      .addEventListener("click", this.pauseSimulation.bind(this));
    document
      .getElementById("reset-btn")!
      .addEventListener("click", this.resetSimulation.bind(this));

    // Fluid Properties
    document
      .getElementById("viscosity")!
      .addEventListener("change", this.updateFluidProperties.bind(this));
    document
      .getElementById("density")!
      .addEventListener("change", this.updateFluidProperties.bind(this));
    document
      .getElementById("flow-rate")!
      .addEventListener("change", this.updateFluidProperties.bind(this));

    // Visualization Options
    document.getElementById("particle-size")!.addEventListener("input", (e) => {
      const size = parseFloat((e.target as HTMLInputElement).value);
      this.visualizer.updateParticleSize(size); // Changed from updateParticles to updateParticleSize
    });

    // Model opacity through material update
    document.getElementById("model-opacity")!.addEventListener("input", (e) => {
      const opacity = parseFloat((e.target as HTMLInputElement).value);
      this.visualizer.updateModelOpacity(opacity);
    });
  }

  private async handleModelImport(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    try {
      const model = await this.modelImporter.importModel(file);
      this.visualizer.setModel(model);

      // Get the mesh from the model
      let mesh: THREE.Mesh | null = null;
      model.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          mesh = child;
        }
      });

      if (!mesh) {
        throw new Error("No mesh found in imported model");
      }

      // Initialize simulator with model geometry
      const bounds = new THREE.Box3().setFromObject(model);
      const fluidProps = this.getFluidProperties();

      // Create complete simulation configuration
      const simulationConfig: SimulationConfig = {
        ...fluidProps,
        bounds: bounds,
      };

      this.simulator = new SPHSimulator(simulationConfig);

      // Show model info
      const modelInfo = document.getElementById("model-info")!;
      modelInfo.textContent = `Model loaded: ${file.name}
            Dimensions: ${bounds.max.x - bounds.min.x}m × 
                       ${bounds.max.y - bounds.min.y}m × 
                       ${bounds.max.z - bounds.min.z}m`;
    } catch (error) {
      console.error("Error importing model:", error);
      alert("Error loading model. Please try another file.");
    }
  }

  private getFluidProperties(): FluidProperties {
    return {
      viscosity: parseFloat(
        (document.getElementById("viscosity") as HTMLInputElement).value
      ),
      density: parseFloat(
        (document.getElementById("density") as HTMLInputElement).value
      ),
      flowRate: parseFloat(
        (document.getElementById("flow-rate") as HTMLInputElement).value
      ),
      timeStep: parseFloat(
        (document.getElementById("time-step") as HTMLInputElement).value
      ),
    };
  }

  private updateFluidProperties(): void {
    if (this.simulator && this.model) {
      const props = this.getFluidProperties();
      const bounds = new THREE.Box3().setFromObject(this.model);
      this.simulator.setSimulationParameters({
        ...props,
        bounds: bounds,
      });
    }
  }

  private startSimulation(): void {
    if (!this.simulator) {
      alert("Please import a model first");
      return;
    }

    this.isSimulating = true;
    this.animate();
  }

  private pauseSimulation(): void {
    this.isSimulating = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private resetSimulation(): void {
    if (!this.simulator) return;

    this.pauseSimulation();
    this.simulator.resetSimulation();

    // Get particle positions and velocities as vec3 arrays
    const particles = this.simulator.getParticlePositions();
    const velocities = this.simulator.getParticleVelocities();

    // Update visualization
    this.visualizer.updateParticles(particles, velocities);
  }

  private animate(): void {
    if (!this.isSimulating || !this.simulator) return;

    // Run simulation step
    const timeStep = this.getFluidProperties().timeStep;
    this.simulator.step(timeStep);

    // Get current particle state
    const particles = this.simulator.getParticlePositions();
    const velocities = this.simulator.getParticleVelocities();

    // Update visualization
    this.visualizer.updateParticles(particles, velocities);

    this.animationFrameId = requestAnimationFrame(() => this.animate());
  }
}

// Start the application
new PipeFlowSimulation();
