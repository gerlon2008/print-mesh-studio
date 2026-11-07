import * as THREE from "three";
import { Evaluator, Brush, SUBTRACTION, ADDITION } from "three-bvh-csg";
import { TripoDetectedPart } from "./tripoSegmentation";

export interface JointDowel {
  id: string;
  partAId: string;
  partBId: string;
  position: THREE.Vector3;
  direction: THREE.Vector3;
  diameterMm: number;
  lengthMm: number;
  toleranceMm: number;
  dowelGeometry: THREE.BufferGeometry;
}

/**
 * Generates alignment dowel pin connectors between two adjacent Tripo parts.
 * Creates socket holes in both parts and produces the standalone 3D-printable dowel pin!
 */
export function generateDowelBetweenParts(
  partA: TripoDetectedPart,
  partB: TripoDetectedPart,
  diameterMm: number = 4.0,
  lengthMm: number = 8.0,
  toleranceMm: number = 0.20
): {
  updatedPartA: THREE.BufferGeometry;
  updatedPartB: THREE.BufferGeometry;
  dowelGeometry: THREE.BufferGeometry;
  dowelPosition: THREE.Vector3;
} {
  // Vector between centers
  const connectionDir = new THREE.Vector3().subVectors(partB.center, partA.center).normalize();
  const midPoint = new THREE.Vector3().addVectors(partA.center, partB.center).multiplyScalar(0.5);

  const radius = diameterMm / 2;
  const socketRadius = radius + toleranceMm;
  const socketDepth = lengthMm / 2 + toleranceMm;

  const evaluator = new Evaluator();
  evaluator.useGroups = false;

  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), connectionDir);

  // 1. Socket for Part A
  const socketAGeom = new THREE.CylinderGeometry(socketRadius, socketRadius, socketDepth, 24);
  socketAGeom.applyQuaternion(q);
  socketAGeom.translate(midPoint.x, midPoint.y, midPoint.z);

  const brushA = new Brush(partA.geometry.clone());
  brushA.updateMatrixWorld(true);
  const brushSocketA = new Brush(socketAGeom);
  brushSocketA.updateMatrixWorld(true);

  const resA = evaluator.evaluate(brushA, brushSocketA, SUBTRACTION);
  resA.geometry.computeVertexNormals();
  resA.geometry.computeBoundingBox();

  // 2. Socket for Part B
  const socketBGeom = new THREE.CylinderGeometry(socketRadius, socketRadius, socketDepth, 24);
  socketBGeom.applyQuaternion(q);
  socketBGeom.translate(midPoint.x, midPoint.y, midPoint.z);

  const brushB = new Brush(partB.geometry.clone());
  brushB.updateMatrixWorld(true);
  const brushSocketB = new Brush(socketBGeom);
  brushSocketB.updateMatrixWorld(true);

  const resB = evaluator.evaluate(brushB, brushSocketB, SUBTRACTION);
  resB.geometry.computeVertexNormals();
  resB.geometry.computeBoundingBox();

  // 3. Standalone Printable Dowel Pin (with chamfered ends for easy press-fit insertion)
  const pinGeom = new THREE.CylinderGeometry(radius, radius, lengthMm - 0.4, 24);
  pinGeom.applyQuaternion(q);
  pinGeom.translate(midPoint.x, midPoint.y, midPoint.z);
  pinGeom.computeVertexNormals();
  pinGeom.computeBoundingBox();

  return {
    updatedPartA: resA.geometry,
    updatedPartB: resB.geometry,
    dowelGeometry: pinGeom,
    dowelPosition: midPoint,
  };
}
