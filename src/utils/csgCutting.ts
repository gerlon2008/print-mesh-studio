import * as THREE from "three";
import { Evaluator, Brush, SUBTRACTION, INTERSECTION, ADDITION } from "three-bvh-csg";
import { CutPlaneConfig, ConnectorPin } from "../types";

export interface CutResult {
  partA: THREE.BufferGeometry; // Above / positive side
  partB: THREE.BufferGeometry; // Below / negative side
  planePoint: THREE.Vector3;
  planeNormal: THREE.Vector3;
}

/**
 * Splits a mesh geometry along a cutting plane using CSG boolean operations,
 * ensuring both resulting halves are watertight, solid 3D-printable meshes.
 */
export function cutMeshWithPlane(
  sourceGeometry: THREE.BufferGeometry,
  config: CutPlaneConfig
): CutResult {
  const evaluator = new Evaluator();
  evaluator.useGroups = false;

  // Clone and ensure normals and bounds are valid
  const baseGeom = sourceGeometry.clone();
  if (!baseGeom.boundingBox) baseGeom.computeBoundingBox();
  const bbox = baseGeom.boundingBox || new THREE.Box3();
  const size = new THREE.Vector3();
  bbox.getSize(size);
  const center = new THREE.Vector3();
  bbox.getCenter(center);

  const maxDimension = Math.max(size.x, size.y, size.z) * 3 + 20;

  // Determine plane origin and normal based on axis and rotation
  const planePoint = center.clone();
  const planeNormal = new THREE.Vector3();

  if (config.axis === "x") {
    planePoint.x += config.offset;
    planeNormal.set(1, 0, 0);
  } else if (config.axis === "y") {
    planePoint.y += config.offset;
    planeNormal.set(0, 1, 0);
  } else {
    // z
    planePoint.z += config.offset;
    planeNormal.set(0, 0, 1);
  }

  // Apply optional rotation around perpendicular axis
  if (config.angle !== 0) {
    const rotRad = (config.angle * Math.PI) / 180;
    if (config.axis === "z") planeNormal.applyAxisAngle(new THREE.Vector3(1, 0, 0), rotRad);
    else if (config.axis === "y") planeNormal.applyAxisAngle(new THREE.Vector3(0, 0, 1), rotRad);
    else planeNormal.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotRad);
  }

  planeNormal.normalize();

  // Create a massive half-space cutter box
  const cutterGeom = new THREE.BoxGeometry(maxDimension, maxDimension, maxDimension);
  
  // Orient the cutter box so its bottom face aligns with the cutting plane
  const cutterMeshPositive = new THREE.Mesh(cutterGeom);
  cutterMeshPositive.position.copy(planePoint).addScaledVector(planeNormal, maxDimension / 2);
  cutterMeshPositive.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), planeNormal);
  cutterMeshPositive.updateMatrixWorld(true);

  const cutterMeshNegative = new THREE.Mesh(cutterGeom.clone());
  cutterMeshNegative.position.copy(planePoint).addScaledVector(planeNormal, -maxDimension / 2);
  cutterMeshNegative.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), planeNormal);
  cutterMeshNegative.updateMatrixWorld(true);

  const sourceBrush = new Brush(baseGeom);
  sourceBrush.updateMatrixWorld(true);

  const posBrush = new Brush(cutterMeshPositive.geometry);
  posBrush.position.copy(cutterMeshPositive.position);
  posBrush.quaternion.copy(cutterMeshPositive.quaternion);
  posBrush.updateMatrixWorld(true);

  const negBrush = new Brush(cutterMeshNegative.geometry);
  negBrush.position.copy(cutterMeshNegative.position);
  negBrush.quaternion.copy(cutterMeshNegative.quaternion);
  negBrush.updateMatrixWorld(true);

  // Part A (Positive half): Subtract the negative box or intersect positive
  const resultPartA = evaluator.evaluate(sourceBrush, negBrush, SUBTRACTION);
  
  // Part B (Negative half): Subtract the positive box
  const resultPartB = evaluator.evaluate(sourceBrush, posBrush, SUBTRACTION);

  resultPartA.geometry.computeVertexNormals();
  resultPartA.geometry.computeBoundingBox();

  resultPartB.geometry.computeVertexNormals();
  resultPartB.geometry.computeBoundingBox();

  return {
    partA: resultPartA.geometry,
    partB: resultPartB.geometry,
    planePoint,
    planeNormal,
  };
}

/**
 * Adds male pin to partA and female cavity (socket) with tolerance clearance to partB
 */
export function applyConnectorsToParts(
  partAGeometry: THREE.BufferGeometry,
  partBGeometry: THREE.BufferGeometry,
  cutInfo: { planePoint: THREE.Vector3; planeNormal: THREE.Vector3 },
  pins: ConnectorPin[]
): { partA: THREE.BufferGeometry; partB: THREE.BufferGeometry } {
  if (pins.length === 0) {
    return { partA: partAGeometry, partB: partBGeometry };
  }

  const evaluator = new Evaluator();
  evaluator.useGroups = false;

  let currentGeomA = partAGeometry.clone();
  let currentGeomB = partBGeometry.clone();

  // Create local orthonormal frame for the cut plane
  const normal = cutInfo.planeNormal.clone().normalize();
  let tangent = new THREE.Vector3(1, 0, 0);
  if (Math.abs(normal.dot(tangent)) > 0.9) {
    tangent = new THREE.Vector3(0, 1, 0);
  }
  const bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();
  tangent.crossVectors(bitangent, normal).normalize();

  // Rotation quaternion to align Z+ cylinder to plane normal
  const pinQuaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    normal
  );

  for (const pin of pins) {
    // Compute 3D world position on the plane
    const pinCenterOnPlane = cutInfo.planePoint
      .clone()
      .addScaledVector(tangent, pin.position[0])
      .addScaledVector(bitangent, pin.position[1]);

    // 1. MALE PIN
    // A cylinder centered such that half or all goes out towards Part B
    // Sticking out in direction opposite to normal into part B
    const malePinGeom = new THREE.CylinderGeometry(
      pin.radius,
      pin.radius,
      pin.height,
      32
    );
    // Align cylinder (Three.js cylinder default is along Y axis)
    malePinGeom.rotateX(Math.PI / 2);

    const malePinMesh = new THREE.Mesh(malePinGeom);
    // Position male pin: protruding out from Part A into Part B by height / 2
    malePinMesh.position.copy(pinCenterOnPlane).addScaledVector(normal, -pin.height / 2);
    malePinMesh.quaternion.copy(pinQuaternion);
    malePinMesh.updateMatrixWorld(true);

    const maleBrush = new Brush(malePinMesh.geometry);
    maleBrush.position.copy(malePinMesh.position);
    maleBrush.quaternion.copy(malePinMesh.quaternion);
    maleBrush.updateMatrixWorld(true);

    const brushA = new Brush(currentGeomA);
    brushA.updateMatrixWorld(true);

    // Union (ADDITION) pin with Part A
    const partAWithPin = evaluator.evaluate(brushA, maleBrush, ADDITION);
    currentGeomA = partAWithPin.geometry;

    // 2. FEMALE CAVITY (SOCKET)
    // Sized with tolerance: radius + tolerance, height + clearance
    const socketRadius = pin.radius + pin.tolerance;
    const socketDepth = pin.height + pin.tolerance * 2; // Extra depth at bottom so pin seats flush
    const femaleSocketGeom = new THREE.CylinderGeometry(
      socketRadius,
      socketRadius,
      socketDepth,
      32
    );
    femaleSocketGeom.rotateX(Math.PI / 2);

    const femaleMesh = new THREE.Mesh(femaleSocketGeom);
    // Cavity goes inside Part B
    femaleMesh.position.copy(pinCenterOnPlane).addScaledVector(normal, -socketDepth / 2);
    femaleMesh.quaternion.copy(pinQuaternion);
    femaleMesh.updateMatrixWorld(true);

    const socketBrush = new Brush(femaleMesh.geometry);
    socketBrush.position.copy(femaleMesh.position);
    socketBrush.quaternion.copy(femaleMesh.quaternion);
    socketBrush.updateMatrixWorld(true);

    const brushB = new Brush(currentGeomB);
    brushB.updateMatrixWorld(true);

    // Subtract socket from Part B
    const partBWithSocket = evaluator.evaluate(brushB, socketBrush, SUBTRACTION);
    currentGeomB = partBWithSocket.geometry;
  }

  currentGeomA.computeVertexNormals();
  currentGeomA.computeBoundingBox();
  currentGeomB.computeVertexNormals();
  currentGeomB.computeBoundingBox();

  return {
    partA: currentGeomA,
    partB: currentGeomB,
  };
}
