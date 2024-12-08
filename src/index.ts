import ModelImporter from "./core/model-importer";
import { SimulationConfig, SPHSimulator } from "./core/sph-simulator";
import { Visualizer } from "./utils/visualizations";
import { GeometryUtils } from "./utils/geometry-utils";
import { ParticleOperations } from "./utils/particle-operations";
import * as THREE from "three";
import { vec3 } from "gl-matrix";
import { OpenFOAMTimeSeriesHandler } from "./adapters/open-foam";

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
  private timeSeriesHandler: OpenFOAMTimeSeriesHandler;
  private currentVisualization: THREE.Group | null = null;

  constructor() {
    this.modelImporter = new ModelImporter();
    this.visualizer = new Visualizer(
      document.getElementById("simulation-container")!
    );
    this.setupEventListeners();
    this.timeSeriesHandler = new OpenFOAMTimeSeriesHandler();
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

    // Add time series controls
    document.getElementById("time-slider")?.addEventListener("input", (e) => {
      const timeStep = parseInt((e.target as HTMLInputElement).value);
      this.updateTimeStep(timeStep);
    });

    // Multiple file input handler for OpenFOAM files
    const foamInput = document.getElementById("foam-input") as HTMLInputElement;
    foamInput?.addEventListener("change", this.handleOpenFOAMImport.bind(this));
  }

  private async handleOpenFOAMImport(event: Event): Promise<void> {
    const files = (event.target as HTMLInputElement).files;
    if (!files || files.length === 0) return;

    try {
      // Load all OpenFOAM VTK files
      await this.timeSeriesHandler.loadSimulationData(files);

      // Get available time steps
      const timeSteps = this.timeSeriesHandler.getAvailableTimeSteps();

      // Update time slider
      const timeSlider = document.getElementById(
        "time-slider"
      ) as HTMLInputElement;
      if (timeSlider) {
        timeSlider.min = timeSteps[0].toString();
        timeSlider.max = timeSteps[timeSteps.length - 1].toString();
        timeSlider.value = timeSteps[0].toString();
      }

      // Create initial visualization
      this.updateTimeStep(timeSteps[0]);

      // Show simulation info
      const simInfo = document.getElementById("simulation-info");
      if (simInfo) {
        simInfo.textContent = `OpenFOAM simulation loaded: ${timeSteps.length} time steps`;
      }
    } catch (error) {
      console.error("Error loading OpenFOAM data:", error);
      alert("Error loading OpenFOAM simulation files.");
    }
  }

  private updateTimeStep(timeStep: number): void {
    // Remove current visualization if it exists
    if (this.currentVisualization) {
      this.visualizer.removeFromScene(this.currentVisualization);
    }

    // Create new visualization for the time step
    this.currentVisualization =
      this.timeSeriesHandler.createVisualization(timeStep);
    this.visualizer.addToScene(this.currentVisualization);

    // Update info display
    const timeInfo = document.getElementById("time-info");
    if (timeInfo) {
      const flowData = this.timeSeriesHandler.getFlowDataAtTime(timeStep);
      if (flowData) {
        const maxVelocity = Math.max(
          ...Array.from(flowData.velocity).reduce((acc: number[], _, i) => {
            if (i % 3 === 0) {
              const vx = flowData.velocity[i];
              const vy = flowData.velocity[i + 1];
              const vz = flowData.velocity[i + 2];
              acc.push(Math.sqrt(vx * vx + vy * vy + vz * vz));
            }
            return acc;
          }, [])
        );

        timeInfo.textContent = `Time: ${timeStep}s, Max Velocity: ${maxVelocity.toFixed(2)} m/s`;
      }
    }
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
