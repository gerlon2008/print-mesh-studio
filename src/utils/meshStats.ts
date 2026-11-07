import * as THREE from "three";
import { MeshStats } from "../types";

export function computeMeshStats(geometry: THREE.BufferGeometry): MeshStats {
  // Ensure bounding box is computed
  if (!geometry.boundingBox) {
    geometry.computeBoundingBox();
  }
  const bbox = geometry.boundingBox || new THREE.Box3();
  const size = new THREE.Vector3();
  bbox.getSize(size);

  const posAttr = geometry.getAttribute("position");
  if (!posAttr) {
    return {
      vertexCount: 0,
      triangleCount: 0,
      dimensions: { x: 0, y: 0, z: 0 },
      volumeCm3: 0,
      surfaceAreaCm2: 0,
      boundingBox: {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 0, y: 0, z: 0 },
      },
    };
  }

  const vertexCount = posAttr.count;
  const indexAttr = geometry.getIndex();
  const triangleCount = indexAttr ? indexAttr.count / 3 : posAttr.count / 3;

  // Calculate volume & surface area
  let signedVolumeMm3 = 0;
  let surfaceAreaMm2 = 0;

  const p1 = new THREE.Vector3();
  const p2 = new THREE.Vector3();
  const p3 = new THREE.Vector3();
  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const cross = new THREE.Vector3();

  const getTriangle = (i: number) => {
    let i1 = i * 3;
    let i2 = i * 3 + 1;
    let i3 = i * 3 + 2;

    if (indexAttr) {
      i1 = indexAttr.getX(i1);
      i2 = indexAttr.getX(i2);
      i3 = indexAttr.getX(i3);
    }

    p1.fromBufferAttribute(posAttr, i1);
    p2.fromBufferAttribute(posAttr, i2);
    p3.fromBufferAttribute(posAttr, i3);
  };

  for (let i = 0; i < triangleCount; i++) {
    getTriangle(i);

    // Signed tetrahedron volume = (p1 . (p2 x p3)) / 6
    cross.crossVectors(p2, p3);
    signedVolumeMm3 += p1.dot(cross) / 6.0;

    // Surface area of triangle = 0.5 * |(p2 - p1) x (p3 - p1)|
    vA.subVectors(p2, p1);
    vB.subVectors(p3, p1);
    cross.crossVectors(vA, vB);
    surfaceAreaMm2 += cross.length() * 0.5;
  }

  const volumeCm3 = Math.abs(signedVolumeMm3) / 1000.0;
  const surfaceAreaCm2 = surfaceAreaMm2 / 100.0;

  return {
    vertexCount,
    triangleCount: Math.round(triangleCount),
    dimensions: {
      x: Number(size.x.toFixed(2)),
      y: Number(size.y.toFixed(2)),
      z: Number(size.z.toFixed(2)),
    },
    volumeCm3: Number(volumeCm3.toFixed(2)),
    surfaceAreaCm2: Number(surfaceAreaCm2.toFixed(2)),
    boundingBox: {
      min: {
        x: Number(bbox.min.x.toFixed(2)),
        y: Number(bbox.min.y.toFixed(2)),
        z: Number(bbox.min.z.toFixed(2)),
      },
      max: {
        x: Number(bbox.max.x.toFixed(2)),
        y: Number(bbox.max.y.toFixed(2)),
        z: Number(bbox.max.z.toFixed(2)),
      },
    },
  };
}
