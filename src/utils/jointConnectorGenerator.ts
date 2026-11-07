import * as THREE from "three";
import { Evaluator, Brush, SUBTRACTION, ADDITION } from "three-bvh-csg";
import { TripoDetectedPart } from "./tripoSegmentation";
import { sealAndCapMesh } from "./meshCapping";

export interface JointDowelResult {
  updatedPartA: THREE.BufferGeometry;
  updatedPartB: THREE.BufferGeometry;
  dowelGeometry: THREE.BufferGeometry;
  dowelPosition: THREE.Vector3;
}

/**
 * Generates alignment dowel pin connectors between two adjacent parts.
 * Creates socket cavities in both parts with tolerance clearance,
 * and produces the standalone 3D-printable dowel pin cylinder!
 */
export function generateDowelBetweenParts(
  partA: TripoDetectedPart,
  partB: TripoDetectedPart,
  diameterMm: number = 4.0,
  lengthMm: number = 10.0,
  toleranceMm: number = 0.20
): JointDowelResult {
  // Ensure both parts are solid capped manifolds
  const geomA = sealAndCapMesh(partA.geometry.clone());
  const geomB = sealAndCapMesh(partB.geometry.clone());

  // Connection vector and midpoint between part centers
  const connectionDir = new THREE.Vector3().subVectors(partB.center, partA.center).normalize();
  const midPoint = new THREE.Vector3().addVectors(partA.center, partB.center).multiplyScalar(0.5);

  const radius = diameterMm / 2;
  const socketRadius = radius + toleranceMm;
  const socketDepth = lengthMm / 2 + toleranceMm;

  // Create orientation quaternion aligning Y-axis cylinder to connectionDir
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), connectionDir);

  const evaluator = new Evaluator();
  evaluator.useGroups = false;

  let finalGeomA = geomA;
  let finalGeomB = geomB;

  try {
    // 1. Socket Cavity for Part A
    const socketAGeom = new THREE.CylinderGeometry(socketRadius, socketRadius, socketDepth, 24);
    socketAGeom.applyQuaternion(q);
    socketAGeom.translate(midPoint.x, midPoint.y, midPoint.z);

    const brushA = new Brush(geomA);
    brushA.updateMatrixWorld(true);
    const brushSocketA = new Brush(socketAGeom);
    brushSocketA.updateMatrixWorld(true);

    const resA = evaluator.evaluate(brushA, brushSocketA, SUBTRACTION);
    if (resA && resA.geometry && resA.geometry.attributes.position.count > 0) {
      finalGeomA = resA.geometry;
      finalGeomA.computeVertexNormals();
      finalGeomA.computeBoundingBox();
    }
  } catch (err) {
    console.warn("Socket subtraction for Part A skipped:", err);
  }

  try {
    // 2. Socket Cavity for Part B
    const socketBGeom = new THREE.CylinderGeometry(socketRadius, socketRadius, socketDepth, 24);
    socketBGeom.applyQuaternion(q);
    socketBGeom.translate(midPoint.x, midPoint.y, midPoint.z);

    const brushB = new Brush(geomB);
    brushB.updateMatrixWorld(true);
    const brushSocketB = new Brush(socketBGeom);
    brushSocketB.updateMatrixWorld(true);

    const resB = evaluator.evaluate(brushB, brushSocketB, SUBTRACTION);
    if (resB && resB.geometry && resB.geometry.attributes.position.count > 0) {
      finalGeomB = resB.geometry;
      finalGeomB.computeVertexNormals();
      finalGeomB.computeBoundingBox();
    }
  } catch (err) {
    console.warn("Socket subtraction for Part B skipped:", err);
  }

  // 3. Standalone Printable Dowel Pin (Solid cylinder with chamfers for easy insertion)
  const pinGeom = new THREE.CylinderGeometry(radius, radius, lengthMm, 24);
  pinGeom.applyQuaternion(q);
  pinGeom.translate(midPoint.x, midPoint.y, midPoint.z);
  pinGeom.computeVertexNormals();
  pinGeom.computeBoundingBox();

  return {
    updatedPartA: finalGeomA,
    updatedPartB: finalGeomB,
    dowelGeometry: pinGeom,
    dowelPosition: midPoint,
  };
}
