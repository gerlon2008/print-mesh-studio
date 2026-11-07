import * as THREE from "three";

/**
 * Creates a professional 3D printer build plate bed (e.g. 256x256 mm Bambu / Ender 3 style)
 */
export function createBuildPlate(sizeMm: number = 250): THREE.Group {
  const group = new THREE.Group();
  group.name = "buildPlate";

  // Base Plate (sheet metal / textured PEI appearance)
  const plateGeom = new THREE.BoxGeometry(sizeMm, sizeMm, 2);
  const plateMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.85,
    metalness: 0.2,
  });
  const plateMesh = new THREE.Mesh(plateGeom, plateMat);
  plateMesh.position.set(0, 0, -1); // Top surface at z = 0
  plateMesh.receiveShadow = true;
  group.add(plateMesh);

  // Border frame
  const edges = new THREE.EdgesGeometry(plateGeom);
  const lineMat = new THREE.LineBasicMaterial({ color: 0x3f3f46, linewidth: 1.5 });
  const frame = new THREE.LineSegments(edges, lineMat);
  frame.position.copy(plateMesh.position);
  group.add(frame);

  // Fine Grid (every 10mm)
  const fineGrid = new THREE.GridHelper(sizeMm, sizeMm / 10, 0x27272a, 0x27272a);
  fineGrid.rotation.x = Math.PI / 2;
  fineGrid.position.set(0, 0, 0.05);
  group.add(fineGrid);

  // Major Grid (every 50mm)
  const majorGrid = new THREE.GridHelper(sizeMm, sizeMm / 50, 0x06b6d4, 0x3f3f46);
  majorGrid.rotation.x = Math.PI / 2;
  majorGrid.position.set(0, 0, 0.1);
  group.add(majorGrid);

  // Build plate corner notch (typical Bambu / Prusa PEI plate align tab)
  const notchGeom = new THREE.BoxGeometry(30, 10, 2);
  const notchMat = new THREE.MeshStandardMaterial({ color: 0x27272a });
  const notch = new THREE.Mesh(notchGeom, notchMat);
  notch.position.set(0, sizeMm / 2 + 5, -1);
  group.add(notch);

  return group;
}
