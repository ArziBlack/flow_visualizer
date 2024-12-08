import * as THREE from "three";
import { VTKLoader } from "three/examples/jsm/loaders/VTKLoader";

interface VTKFlowData {
  velocity: Float32Array;
  pressure: Float32Array;
  temperature?: Float32Array;
  timeStep: number;
}

interface BoundaryCondition {
  type: "inlet" | "outlet" | "wall";
  geometry: THREE.BufferGeometry;
}

export class OpenFOAMTimeSeriesHandler {
  private vtkLoader: VTKLoader;
  private timeSteps: Map<number, VTKFlowData> = new Map();
  private boundaries: Map<string, BoundaryCondition> = new Map();
  private currentTimeStep: number = 0;

  constructor() {
    this.vtkLoader = new VTKLoader();
  }

  async loadSimulationData(files: FileList): Promise<void> {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = file.name.toLowerCase();

      if (fileName.includes("pigging-simulation_")) {
        // Handle time series data
        const timeStep = parseInt(fileName.match(/\d+/)?.[0] ?? "0");
        await this.loadTimeStep(file, timeStep);
      } else if (["inlet", "outlet", "walls"].includes(fileName)) {
        // Handle boundary conditions
        await this.loadBoundary(file, fileName as "inlet" | "outlet" | "wall");
      }
    }
  }

  private async loadTimeStep(file: File, timeStep: number): Promise<void> {
    const url = URL.createObjectURL(file);
    try {
      const geometry = await this.vtkLoader.loadAsync(url);
      const flowData = await this.parseVTKFile(file);
      flowData.timeStep = timeStep;
      this.timeSteps.set(timeStep, flowData);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  private async loadBoundary(
    file: File,
    type: "inlet" | "outlet" | "wall"
  ): Promise<void> {
    const url = URL.createObjectURL(file);
    try {
      const geometry = await this.vtkLoader.loadAsync(url);
      this.boundaries.set(type, { type, geometry });
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  public getAvailableTimeSteps(): number[] {
    return Array.from(this.timeSteps.keys()).sort((a, b) => a - b);
  }

  public getCurrentTimeStep(): number {
    return this.currentTimeStep;
  }

  public getFlowDataAtTime(timeStep: number): VTKFlowData | undefined {
    return this.timeSteps.get(timeStep);
  }

  public getBoundaries(): Map<string, BoundaryCondition> {
    return this.boundaries;
  }

  public createVisualization(timeStep: number): THREE.Group {
    const group = new THREE.Group();

    // Add boundaries with different colors
    const boundaryColors = {
      inlet: 0x00ff00, // Green
      outlet: 0xff0000, // Red
      wall: 0x808080, // Gray
    };

    this.boundaries.forEach((boundary, type) => {
      const material = new THREE.MeshPhongMaterial({
        color: boundaryColors[type as keyof typeof boundaryColors],
        transparent: true,
        opacity: 0.5,
      });
      const mesh = new THREE.Mesh(boundary.geometry, material);
      group.add(mesh);
    });

    // Add flow visualization if we have data for this time step
    const flowData = this.timeSteps.get(timeStep);
    if (flowData) {
      const geometry = new THREE.BufferGeometry();
      if (flowData.velocity) {
        geometry.setAttribute(
          "velocity",
          new THREE.BufferAttribute(flowData.velocity, 3)
        );
      }
      if (flowData.pressure) {
        geometry.setAttribute(
          "pressure",
          new THREE.BufferAttribute(flowData.pressure, 1)
        );
      }

      const material = this.createFlowVisualizationMaterial("velocity");
      const mesh = new THREE.Mesh(geometry, material);
      group.add(mesh);
    }

    return group;
  }

  private async parseVTKFile(file: File): Promise<VTKFlowData> {
    const text = await file.text();
    const lines = text.split("\n");

    const flowData: VTKFlowData = {
      velocity: new Float32Array(0),
      pressure: new Float32Array(0),
      timeStep: 0,
    };

    let readingVelocity = false;
    let readingPressure = false;
    let velocityData: number[] = [];
    let pressureData: number[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.includes("VECTORS U")) {
        readingVelocity = true;
        continue;
      }

      if (line.includes("SCALARS p") || line.includes("SCALARS pressure")) {
        readingPressure = true;
        i++; // Skip LOOKUP_TABLE line
        continue;
      }

      if (readingVelocity) {
        if (line.length === 0 || line.includes("SCALARS")) {
          readingVelocity = false;
          flowData.velocity = new Float32Array(velocityData);
        } else {
          const values = line.split(/\s+/).map(Number);
          velocityData.push(...values);
        }
      }

      if (readingPressure) {
        if (line.length === 0 || line.includes("VECTORS")) {
          readingPressure = false;
          flowData.pressure = new Float32Array(pressureData);
        } else {
          const values = line.split(/\s+/).map(Number);
          pressureData.push(...values);
        }
      }
    }

    return flowData;
  }

  private createFlowVisualizationMaterial(
    type: "velocity" | "pressure"
  ): THREE.Material {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        minVal: { value: 0.0 },
        maxVal: { value: 100.0 },
      },
      vertexShader: `
                varying vec3 vColor;
                attribute vec3 velocity;
                attribute float pressure;

                vec3 getHeatMapColor(float value, float min, float max) {
                    float normalized = (value - min) / (max - min);
                    
                    vec3 blue = vec3(0.0, 0.0, 1.0);
                    vec3 cyan = vec3(0.0, 1.0, 1.0);
                    vec3 green = vec3(0.0, 1.0, 0.0);
                    vec3 yellow = vec3(1.0, 1.0, 0.0);
                    vec3 red = vec3(1.0, 0.0, 0.0);
                    
                    if (normalized < 0.25) {
                        return mix(blue, cyan, normalized * 4.0);
                    } else if (normalized < 0.5) {
                        return mix(cyan, green, (normalized - 0.25) * 4.0);
                    } else if (normalized < 0.75) {
                        return mix(green, yellow, (normalized - 0.5) * 4.0);
                    } else {
                        return mix(yellow, red, (normalized - 0.75) * 4.0);
                    }
                }

                void main() {
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_Position = projectionMatrix * mvPosition;
                    
                    float value = ${type === "velocity" ? "length(velocity)" : "pressure"};
                    vColor = getHeatMapColor(value, minVal, maxVal);
                }
            `,
      fragmentShader: `
                varying vec3 vColor;
                void main() {
                    gl_FragColor = vec4(vColor, 1.0);
                }
            `,
    });

    return material;
  }
}
