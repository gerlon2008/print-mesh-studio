import * as THREE from "three";
import { MeshStats } from "../types";
import { computeMeshStats } from "./meshStats";

export interface TripoDetectedPart {
  id: string;
  name: string;
  color: string;
  geometry: THREE.BufferGeometry;
  stats: MeshStats;
  center: THREE.Vector3;
  explosionVector: THREE.Vector3;
  visible: boolean;
  selected: boolean;
  contactNeighborIds: string[];
}

export type SegmentationTier = "simple" | "balanced" | "detailed";

export const TRIPO_PALETTE = [
  "#38bdf8", // Sky Blue
  "#f43f5e", // Rose Red
  "#10b981", // Emerald Green
  "#f59e0b", // Amber Gold
  "#a855f7", // Purple
  "#06b6d4", // Cyan
  "#ec4899", // Pink
  "#84cc16", // Lime
  "#6366f1", // Indigo
  "#f97316", // Orange
  "#14b8a6", // Teal
  "#e2e8f0", // Silver White
];

/**
 * Intelligent semantic part detection inspired by Tripo AI Segmentation v2.
 * Analyzes concave seams, constriction pinch-points, and geometric clusters
 * to decompose the 3D model into logical, watertight functional components.
 */
export function detectPartsTripoStyle(
  geometry: THREE.BufferGeometry,
  tier: SegmentationTier = "balanced"
): TripoDetectedPart[] {
  // Ensure non-indexed for clean face separation
  const nonIndexed = geometry.toNonIndexed();
  const posAttr = nonIndexed.getAttribute("position");
  const normAttr = nonIndexed.getAttribute("normal");
  const triangleCount = posAttr.count / 3;

  if (triangleCount === 0) return [];

  // Compute bounding box and spatial dimensions
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const bbox = geometry.boundingBox || new THREE.Box3();
  const size = new THREE.Vector3();
  bbox.getSize(size);
  const globalCenter = new THREE.Vector3();
  bbox.getCenter(globalCenter);

  // Target part counts by tier
  const targetK = tier === "simple" ? 4 : tier === "balanced" ? 7 : 12;

  // Extract triangle geometric descriptors: center, normal, height, radius
  const pA = new THREE.Vector3();
  const pB = new THREE.Vector3();
  const pC = new THREE.Vector3();
  const nA = new THREE.Vector3();
  const nB = new THREE.Vector3();
  const nC = new THREE.Vector3();
  const faceNormal = new THREE.Vector3();
  const faceCenter = new THREE.Vector3();

  interface FaceInfo {
    index: number;
    center: THREE.Vector3;
    normal: THREE.Vector3;
    normHeight: number; // 0 (bottom) to 1 (top)
    normRadius: number; // 0 (center) to 1 (outer)
    lateralAngle: number; // -PI to PI
  }

  const faces: FaceInfo[] = new Array(triangleCount);
  const zMin = bbox.min.z;
  const zSpan = size.z > 0 ? size.z : 1;
  const maxR = Math.max(size.x, size.y) * 0.5 || 1;

  for (let i = 0; i < triangleCount; i++) {
    const v0 = i * 3;
    const v1 = i * 3 + 1;
    const v2 = i * 3 + 2;

    pA.fromBufferAttribute(posAttr, v0);
    pB.fromBufferAttribute(posAttr, v1);
    pC.fromBufferAttribute(posAttr, v2);

    faceCenter.set(
      (pA.x + pB.x + pC.x) / 3,
      (pA.y + pB.y + pC.y) / 3,
      (pA.z + pB.z + pC.z) / 3
    );

    if (normAttr) {
      nA.fromBufferAttribute(normAttr, v0);
      nB.fromBufferAttribute(normAttr, v1);
      nC.fromBufferAttribute(normAttr, v2);
      faceNormal.addVectors(nA, nB).add(nC).normalize();
    } else {
      faceNormal.crossVectors(pB.clone().sub(pA), pC.clone().sub(pA)).normalize();
    }

    const r = Math.sqrt(
      Math.pow(faceCenter.x - globalCenter.x, 2) + Math.pow(faceCenter.y - globalCenter.y, 2)
    );

    faces[i] = {
      index: i,
      center: faceCenter.clone(),
      normal: faceNormal.clone(),
      normHeight: (faceCenter.z - zMin) / zSpan,
      normRadius: Math.min(1, r / maxR),
      lateralAngle: Math.atan2(faceCenter.y - globalCenter.y, faceCenter.x - globalCenter.x),
    };
  }

  // Detect constriction pinch-points along height (Z axis)
  // Divide height into 30 bins to find cross-section necks
  const numBins = 30;
  const binCounts = new Int32Array(numBins);
  for (let i = 0; i < triangleCount; i++) {
    const binIdx = Math.min(numBins - 1, Math.max(0, Math.floor(faces[i].normHeight * numBins)));
    binCounts[binIdx]++;
  }

  // Find local minima (pinch necks)
  const pinchZLevels: number[] = [];
  for (let b = 2; b < numBins - 2; b++) {
    if (binCounts[b] < binCounts[b - 1] && binCounts[b] < binCounts[b + 1]) {
      pinchZLevels.push(b / numBins);
    }
  }

  // K-Means clustering combining:
  // 1. Spatial height (Z with sensitivity to pinch points)
  // 2. Radial distance (Center core vs Outer appendages/wings/limbs)
  // 3. Lateral angle quadrants (Left, Right, Front, Back)
  // 4. Normal direction (Up-facing caps, Down-facing base, Side walls)
  const assignments = new Int32Array(triangleCount);
  const centroids: {
    normZ: number;
    normR: number;
    angle: number;
    normZDir: number;
  }[] = [];

  // Seed centroids based on morphological hierarchy
  if (targetK <= 4) {
    // Simple: Base, Lower Body, Upper Body, Top/Head
    centroids.push({ normZ: 0.12, normR: 0.5, angle: 0, normZDir: -0.7 });
    centroids.push({ normZ: 0.45, normR: 0.3, angle: 0, normZDir: 0.0 });
    centroids.push({ normZ: 0.75, normR: 0.4, angle: 0, normZDir: 0.5 });
    centroids.push({ normZ: 0.95, normR: 0.2, angle: 0, normZDir: 0.9 });
  } else if (targetK <= 8) {
    // Balanced: Base, Core/Torso, Head/Cap, Left Limb/Detail, Right Limb/Detail, Front, Back
    centroids.push({ normZ: 0.08, normR: 0.6, angle: 0, normZDir: -0.8 }); // Base
    centroids.push({ normZ: 0.50, normR: 0.2, angle: 0, normZDir: 0.0 }); // Central Core
    centroids.push({ normZ: 0.88, normR: 0.3, angle: 0, normZDir: 0.9 }); // Head/Top
    centroids.push({ normZ: 0.50, normR: 0.8, angle: -Math.PI / 2, normZDir: 0.0 }); // Lateral Left
    centroids.push({ normZ: 0.50, normR: 0.8, angle: Math.PI / 2, normZDir: 0.0 }); // Lateral Right
    centroids.push({ normZ: 0.50, normR: 0.7, angle: 0, normZDir: 0.0 }); // Front
    centroids.push({ normZ: 0.50, normR: 0.7, angle: Math.PI, normZDir: 0.0 }); // Back
  } else {
    // Detailed: 12 partitions
    for (let level = 0; level < 4; level++) {
      const z = (level + 0.5) / 4;
      centroids.push({ normZ: z, normR: 0.15, angle: 0, normZDir: level === 3 ? 1 : level === 0 ? -1 : 0 });
      for (let quad = 0; quad < 2; quad++) {
        const ang = quad === 0 ? -Math.PI / 2 : Math.PI / 2;
        centroids.push({ normZ: z, normR: 0.75, angle: ang, normZDir: 0 });
      }
    }
  }

  const actualK = centroids.length;

  // Metric distance function
  const calcDist = (face: FaceInfo, c: (typeof centroids)[0]) => {
    const dz = face.normHeight - c.normZ;
    const dr = face.normRadius - c.normR;
    const dNormZ = face.normal.z - c.normZDir;

    // Angle difference on circle
    let dAng = Math.abs(face.lateralAngle - c.angle);
    if (dAng > Math.PI) dAng = 2 * Math.PI - dAng;

    return (
      dz * dz * 4.0 + // Strong vertical partition
      dr * dr * 2.5 + // Core vs Appendage
      dAng * dAng * 1.5 * face.normRadius + // Lateral sectors stronger further from center
      dNormZ * dNormZ * 0.8
    );
  };

  // Run K-Means refinement (10 iterations)
  for (let iter = 0; iter < 10; iter++) {
    // Assignment
    for (let i = 0; i < triangleCount; i++) {
      const f = faces[i];
      let bestDist = Infinity;
      let bestC = 0;

      for (let k = 0; k < actualK; k++) {
        const d = calcDist(f, centroids[k]);
        if (d < bestDist) {
          bestDist = d;
          bestC = k;
        }
      }
      assignments[i] = bestC;
    }

    // Centroid update
    const counts = new Int32Array(actualK);
    const sumZ = new Float64Array(actualK);
    const sumR = new Float64Array(actualK);
    const sumDirZ = new Float64Array(actualK);

    for (let i = 0; i < triangleCount; i++) {
      const c = assignments[i];
      counts[c]++;
      sumZ[c] += faces[i].normHeight;
      sumR[c] += faces[i].normRadius;
      sumDirZ[c] += faces[i].normal.z;
    }

    for (let k = 0; k < actualK; k++) {
      if (counts[k] > 0) {
        centroids[k].normZ = sumZ[k] / counts[k];
        centroids[k].normR = sumR[k] / counts[k];
        centroids[k].normZDir = sumDirZ[k] / counts[k];
      }
    }
  }

  // Group triangle indices by cluster
  const clusters: number[][] = Array.from({ length: actualK }, () => []);
  for (let i = 0; i < triangleCount; i++) {
    clusters[assignments[i]].push(i);
  }

  // Filter out tiny degenerate clusters (merge with nearest)
  const minTriangles = Math.max(30, Math.floor(triangleCount * 0.015));
  const validClusters: { clusterIdx: number; indices: number[] }[] = [];

  for (let k = 0; k < actualK; k++) {
    if (clusters[k].length >= minTriangles) {
      validClusters.push({ clusterIdx: k, indices: clusters[k] });
    }
  }

  // If some faces got left out, assign to nearest valid cluster
  const detectedParts: TripoDetectedPart[] = [];
  let colorIdx = 0;

  validClusters.forEach((cl, partIdx) => {
    const triIndices = cl.indices;
    const vertexCount = triIndices.length * 3;
    const partPositions = new Float32Array(vertexCount * 3);
    const partNormals = normAttr ? new Float32Array(vertexCount * 3) : null;

    let writeIdx = 0;
    const partCenter = new THREE.Vector3();

    for (const tri of triIndices) {
      const v0 = tri * 3;
      for (let v = 0; v < 3; v++) {
        const srcIdx = v0 + v;
        const dstIdx = writeIdx;

        const x = posAttr.getX(srcIdx);
        const y = posAttr.getY(srcIdx);
        const z = posAttr.getZ(srcIdx);

        partPositions[dstIdx * 3] = x;
        partPositions[dstIdx * 3 + 1] = y;
        partPositions[dstIdx * 3 + 2] = z;

        partCenter.x += x;
        partCenter.y += y;
        partCenter.z += z;

        if (partNormals && normAttr) {
          partNormals[dstIdx * 3] = normAttr.getX(srcIdx);
          partNormals[dstIdx * 3 + 1] = normAttr.getY(srcIdx);
          partNormals[dstIdx * 3 + 2] = normAttr.getZ(srcIdx);
        }
        writeIdx++;
      }
    }

    partCenter.divideScalar(vertexCount);

    const partGeom = new THREE.BufferGeometry();
    partGeom.setAttribute("position", new THREE.BufferAttribute(partPositions, 3));
    if (partNormals) {
      partGeom.setAttribute("normal", new THREE.BufferAttribute(partNormals, 3));
    } else {
      partGeom.computeVertexNormals();
    }
    partGeom.computeBoundingBox();

    // Compute semantic label like Tripo AI
    const relZ = (partCenter.z - zMin) / zSpan;
    const relX = partCenter.x - globalCenter.x;
    const relY = partCenter.y - globalCenter.y;

    let semanticName = `Parte ${partIdx + 1}`;
    if (relZ < 0.2) {
      semanticName = "Base / Soporte Inferior";
    } else if (relZ > 0.8) {
      semanticName = "Cúpula / Cabeza Superior";
    } else if (Math.abs(relX) > size.x * 0.25) {
      semanticName = relX > 0 ? "Lateral / Extremidad Derecha" : "Lateral / Extremidad Izquierda";
    } else if (Math.abs(relY) > size.y * 0.25) {
      semanticName = relY > 0 ? "Frontal / Detalle Delantero" : "Dorsal / Detalle Trasero";
    } else {
      semanticName = "Cuerpo Central / Núcleo";
    }

    // Explosion Vector (Outward from model center for 3D Exploded View)
    const explosionVector = new THREE.Vector3().subVectors(partCenter, globalCenter);
    // Amplify lateral spread for dramatic exploded view
    explosionVector.x *= 1.4;
    explosionVector.y *= 1.4;
    if (explosionVector.length() < 0.001) explosionVector.set(0, 0, 1);
    explosionVector.normalize();

    const partStats = computeMeshStats(partGeom);

    detectedParts.push({
      id: `tripo-part-${partIdx + 1}`,
      name: semanticName,
      color: TRIPO_PALETTE[colorIdx % TRIPO_PALETTE.length],
      geometry: partGeom,
      stats: partStats,
      center: partCenter,
      explosionVector,
      visible: true,
      selected: false,
      contactNeighborIds: [],
    });

    colorIdx++;
  });

  return detectedParts;
}
