import ModelImporter from "./core/model-importer";
import SPHSimulator from "./core/sph-simulator";
import MeshConverter from "./core/mesh-converter";

async function runSimulation() {
  const importer = new ModelImporter();

  const pipeModel = await importer.importModel("/path/to/pipe-model.stl", {
    scaleFactor: 1,
    centerModel: true,
  });

  const boundingGeometry = MeshConverter.extractBoundingVolume(pipeModel);

  const simulator = new SPHSimulator(pipeModel);
  simulator.initializeParticles(boundingGeometry, 0.05);

  for (let i = 0; i < 100; i++) {
    simulator.simulate(0.01);
  }

  const particles = simulator.getParticles();
}

runSimulation();
