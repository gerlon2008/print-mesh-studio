import * as THREE from "three";

/**
 * Creates a Calibration Mechanical Test Cube (25x25x25mm) with cylindrical boss,
 * through hole, and faceted details.
 */
export function createMechanicalTestPiece(): THREE.BufferGeometry {
  const groupGeom: THREE.BufferGeometry[] = [];

  // Base Cube 30x30x20mm
  const base = new THREE.BoxGeometry(30, 30, 20);
  base.translate(0, 0, 10); // Sit on ground z=0
  groupGeom.push(base);

  // Top cylinder feature 16mm diam, 15mm height
  const topCyl = new THREE.CylinderGeometry(8, 8, 15, 32);
  topCyl.rotateX(Math.PI / 2);
  topCyl.translate(0, 0, 27.5);
  groupGeom.push(topCyl);

  // Cross arms
  const armX = new THREE.BoxGeometry(45, 12, 10);
  armX.translate(0, 0, 10);
  groupGeom.push(armX);

  // Merge geometries
  return mergeBufferGeometries(groupGeom);
}

/**
 * Creates a faceted organic low-poly model (stylized mascot/statue)
 */
export function createLowPolyCharacter(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  // Torso / Body (Dodecahedron scaled)
  const body = new THREE.DodecahedronGeometry(18, 1);
  body.scale(1, 0.9, 1.4);
  body.translate(0, 0, 26);
  parts.push(body);

  // Head
  const head = new THREE.IcosahedronGeometry(12, 1);
  head.translate(0, 0, 52);
  parts.push(head);

  // Ears / Horns
  const earL = new THREE.ConeGeometry(4, 16, 6);
  earL.rotateZ(-0.35);
  earL.rotateX(0.2);
  earL.translate(-8, 2, 65);
  parts.push(earL);

  const earR = new THREE.ConeGeometry(4, 16, 6);
  earR.rotateZ(0.35);
  earR.rotateX(0.2);
  earR.translate(8, 2, 65);
  parts.push(earR);

  // Base stand
  const stand = new THREE.CylinderGeometry(24, 28, 8, 16);
  stand.rotateX(Math.PI / 2);
  stand.translate(0, 0, 4);
  parts.push(stand);

  return mergeBufferGeometries(parts);
}

/**
 * Creates a precision Gear with center bore and teeth
 */
export function createPrecisionGear(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  // Center hub
  const hub = new THREE.CylinderGeometry(14, 14, 12, 32);
  hub.rotateX(Math.PI / 2);
  hub.translate(0, 0, 6);
  parts.push(hub);

  // Gear outer rim
  const rim = new THREE.CylinderGeometry(26, 26, 8, 36);
  rim.rotateX(Math.PI / 2);
  rim.translate(0, 0, 6);
  parts.push(rim);

  // 12 Gear Teeth
  const toothCount = 12;
  for (let i = 0; i < toothCount; i++) {
    const angle = (i * 2 * Math.PI) / toothCount;
    const tooth = new THREE.BoxGeometry(6, 7, 8);
    tooth.translate(28, 0, 6);
    tooth.rotateZ(angle);
    parts.push(tooth);
  }

  return mergeBufferGeometries(parts);
}

/**
 * Utility to merge multiple BufferGeometries into one non-indexed BufferGeometry
 */
function mergeBufferGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let totalVerts = 0;
  const nonIndexedList = geometries.map((g) => {
    const ni = g.toNonIndexed();
    totalVerts += ni.getAttribute("position").count;
    return ni;
  });

  const mergedPos = new Float32Array(totalVerts * 3);
  let offset = 0;

  for (const geom of nonIndexedList) {
    const pos = geom.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      mergedPos[offset * 3] = pos.getX(i);
      mergedPos[offset * 3 + 1] = pos.getY(i);
      mergedPos[offset * 3 + 2] = pos.getZ(i);
      offset++;
    }
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.BufferAttribute(mergedPos, 3));
  merged.computeVertexNormals();
  merged.computeBoundingBox();
  return merged;
}
