import * as THREE from "three";

/**
 * Creates a clean, subtle semi-transparent floor grid (no solid black box).
 * Designed to provide a sense of scale without cutting through or obstructing models.
 */
export function createBuildPlate(sizeMm: number = 250): THREE.Group {
  const group = new THREE.Group();
  group.name = "buildPlate";

  // Fine Grid (every 10mm) - subtle and transparent
  const fineGrid = new THREE.GridHelper(sizeMm, sizeMm / 10, 0x3f3f46, 0x27272a);
  fineGrid.rotation.x = Math.PI / 2;
  fineGrid.position.set(0, 0, 0);
  (fineGrid.material as THREE.Material).transparent = true;
  (fineGrid.material as THREE.Material).opacity = 0.35;
  group.add(fineGrid);

  // Major Axis Lines (Cyan / Amber accents)
  const majorGrid = new THREE.GridHelper(sizeMm, sizeMm / 50, 0x06b6d4, 0x52525b);
  majorGrid.rotation.x = Math.PI / 2;
  majorGrid.position.set(0, 0, 0.02);
  (majorGrid.material as THREE.Material).transparent = true;
  (majorGrid.material as THREE.Material).opacity = 0.5;
  group.add(majorGrid);

  return group;
}
