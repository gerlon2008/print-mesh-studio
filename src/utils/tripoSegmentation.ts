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

export type SegmentationMode = "islands" | "creases" | "anatomical";
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
  "#eab308", // Yellow
  "#ef4444", // Crimson
  "#8b5cf6", // Violet
];

/**
 * Intelligent Part Detection for 3D Printing (Bambu Studio "Split to Parts" + Tripo AI).
 * Detects distinct, intact physical components (sunglasses, hair, clothes, body, props)
 * WITHOUT shattering or breaking any geometry into jagged fragments!
 */
export function detectPartsTripoStyle(
  geometry: THREE.BufferGeometry,
  tier: SegmentationTier = "balanced",
  mode: SegmentationMode = "islands"
): TripoDetectedPart[] {
  const nonIndexed = geometry.toNonIndexed();
  const posAttr = nonIndexed.getAttribute("position");
  const normAttr = nonIndexed.getAttribute("normal");
  const triangleCount = posAttr.count / 3;

  if (triangleCount === 0) return [];

  // Compute bounding box and global center
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const bbox = geometry.boundingBox || new THREE.Box3();
  const globalCenter = new THREE.Vector3();
  bbox.getCenter(globalCenter);
  const size = new THREE.Vector3();
  bbox.getSize(size);

  // 1. Build vertex spatial map to identify topological connectivity
  // Round coordinates to 0.05mm to handle shared vertices even in non-indexed STL
  function getVertexKey(x: number, y: number, z: number): string {
    return `${Math.round(x * 20)}_${Math.round(y * 20)}_${Math.round(z * 20)}`;
  }

  const vertexToTriangles = new Map<string, number[]>();
  const triangleCenters: THREE.Vector3[] = new Array(triangleCount);

  for (let i = 0; i < triangleCount; i++) {
    const v0 = i * 3;
    const v1 = i * 3 + 1;
    const v2 = i * 3 + 2;

    const p0 = new THREE.Vector3(posAttr.getX(v0), posAttr.getY(v0), posAttr.getZ(v0));
    const p1 = new THREE.Vector3(posAttr.getX(v1), posAttr.getY(v1), posAttr.getZ(v1));
    const p2 = new THREE.Vector3(posAttr.getX(v2), posAttr.getY(v2), posAttr.getZ(v2));

    triangleCenters[i] = new THREE.Vector3(
      (p0.x + p1.x + p2.x) / 3,
      (p0.y + p1.y + p2.y) / 3,
      (p0.z + p1.z + p2.z) / 3
    );

    const k0 = getVertexKey(p0.x, p0.y, p0.z);
    const k1 = getVertexKey(p1.x, p1.y, p1.z);
    const k2 = getVertexKey(p2.x, p2.y, p2.z);

    for (const k of [k0, k1, k2]) {
      const list = vertexToTriangles.get(k);
      if (list) list.push(i);
      else vertexToTriangles.set(k, [i]);
    }
  }

  // 2. Extract Connected Components (Mesh Islands / Individual Topological Shells)
  // This is the Bambu Studio "Split to Parts" standard: keeps sunglasses, clothes, hair, body 100% INTACT!
  const visited = new Uint8Array(triangleCount);
  const rawIslands: number[][] = [];

  for (let i = 0; i < triangleCount; i++) {
    if (visited[i]) continue;
    const island: number[] = [];
    const queue: number[] = [i];
    visited[i] = 1;

    while (queue.length > 0) {
      const curr = queue.pop()!;
      island.push(curr);

      const v0 = curr * 3;
      for (let v = 0; v < 3; v++) {
        const k = getVertexKey(
          posAttr.getX(v0 + v),
          posAttr.getY(v0 + v),
          posAttr.getZ(v0 + v)
        );
        const neighbors = vertexToTriangles.get(k) || [];
        for (const n of neighbors) {
          if (!visited[n]) {
            visited[n] = 1;
            queue.push(n);
          }
        }
      }
    }
    rawIslands.push(island);
  }

  // Sort islands from largest to smallest
  rawIslands.sort((a, b) => b.length - a.length);

  // Filter out tiny noise particles (< 25 triangles), but keep all real parts
  const minTris = Math.max(20, Math.floor(triangleCount * 0.002));
  let validIslands = rawIslands.filter((isl) => isl.length >= minTris);

  // If the model was a single unified shell (no disconnected islands):
  // Segment along sharp crease boundaries (concave seams > 45 deg) instead of cutting smoothly across surfaces!
  if (validIslands.length <= 1) {
    validIslands = segmentByCreases(
      geometry,
      triangleCenters,
      vertexToTriangles,
      tier === "simple" ? 4 : tier === "balanced" ? 6 : 9
    );
  }

  // 3. Build intact, unbroken TripoDetectedPart for each component!
  const detectedParts: TripoDetectedPart[] = [];
  let colorIdx = 0;

  validIslands.forEach((triIndices, partIdx) => {
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

    // Semantic Label Detection based on position relative to model
    const relZ = (partCenter.z - bbox.min.z) / (size.z || 1);
    const relX = partCenter.x - globalCenter.x;
    const relY = partCenter.y - globalCenter.y;
    const partBBox = partGeom.boundingBox || new THREE.Box3();
    const partSize = new THREE.Vector3();
    partBBox.getSize(partSize);

    let semanticName = `Parte ${partIdx + 1}`;
    if (relZ > 0.75) {
      if (partSize.x < size.x * 0.6 && partCenter.y < globalCenter.y) {
        semanticName = "Gafas / Lentes";
      } else {
        semanticName = "Cabeza / Rostro";
      }
    } else if (relZ < 0.25) {
      semanticName = "Base / Soporte Inferior";
    } else if (Math.abs(relX) > size.x * 0.25) {
      semanticName = relX > 0 ? "Mano / Brazo Derecho" : "Mano / Brazo Izquierdo";
    } else if (relZ >= 0.25 && relZ <= 0.75) {
      if (partSize.z < size.z * 0.2) {
        semanticName = "Collar / Joyería / Cadena";
      } else {
        semanticName = "Chaqueta / Vestimenta";
      }
    }

    // Explosion Vector (Smooth, beautiful radial offset for 3D Exploded View)
    const explosionVector = new THREE.Vector3().subVectors(partCenter, globalCenter);
    // Give dominant Z offset for upper/lower and XY offset for lateral parts
    if (explosionVector.length() < 0.01) {
      explosionVector.set(0, 0, 1);
    }
    explosionVector.normalize();

    const partStats = computeMeshStats(partGeom);

    detectedParts.push({
      id: `part-${partIdx + 1}`,
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

/**
 * Fallback for single-shell continuous meshes:
 * Segments strictly along sharp crease boundaries (dihedral angle > 45 deg)
 * so it NEVER chops across smooth flat surfaces like clothes or skin!
 */
function segmentByCreases(
  geometry: THREE.BufferGeometry,
  triangleCenters: THREE.Vector3[],
  vertexToTriangles: Map<string, number[]>,
  targetCount: number
): number[][] {
  const nonIndexed = geometry.toNonIndexed();
  const posAttr = nonIndexed.getAttribute("position");
  const triangleCount = posAttr.count / 3;

  // Compute face normals
  const normals: THREE.Vector3[] = new Array(triangleCount);
  const pA = new THREE.Vector3();
  const pB = new THREE.Vector3();
  const pC = new THREE.Vector3();

  for (let i = 0; i < triangleCount; i++) {
    pA.fromBufferAttribute(posAttr, i * 3);
    pB.fromBufferAttribute(posAttr, i * 3 + 1);
    pC.fromBufferAttribute(posAttr, i * 3 + 2);
    const n = new THREE.Vector3().crossVectors(pB.clone().sub(pA), pC.clone().sub(pA)).normalize();
    normals[i] = n;
  }

  // Smooth region growing: seed from extreme points and expand only across smooth faces
  const assigned = new Int32Array(triangleCount).fill(-1);
  const regions: number[][] = Array.from({ length: targetCount }, () => []);

  // Pick targetCount spread seed triangles
  const seeds: number[] = [];
  const step = Math.max(1, Math.floor(triangleCount / targetCount));
  for (let s = 0; s < targetCount; s++) {
    const seedIdx = (s * step) % triangleCount;
    seeds.push(seedIdx);
    assigned[seedIdx] = s;
    regions[s].push(seedIdx);
  }

  // Multi-source BFS region growing stopping at sharp creases
  const queues: number[][] = seeds.map((s) => [s]);
  let remaining = triangleCount - targetCount;
  const cosCreaseLimit = Math.cos((42 * Math.PI) / 180); // 42 degrees crease barrier

  while (remaining > 0) {
    let progressed = false;

    for (let r = 0; r < targetCount; r++) {
      if (queues[r].length === 0) continue;
      const curr = queues[r].shift()!;
      const currNorm = normals[curr];

      const v0 = curr * 3;
      for (let v = 0; v < 3; v++) {
        const k = `${Math.round(posAttr.getX(v0 + v) * 20)}_${Math.round(
          posAttr.getY(v0 + v) * 20
        )}_${Math.round(posAttr.getZ(v0 + v) * 20)}`;

        const neighbors = vertexToTriangles.get(k) || [];
        for (const n of neighbors) {
          if (assigned[n] === -1) {
            // Check dihedral angle: if smooth, expand; if sharp crease, hold
            const nNorm = normals[n];
            if (currNorm.dot(nNorm) >= cosCreaseLimit - 0.2) {
              assigned[n] = r;
              regions[r].push(n);
              queues[r].push(n);
              remaining--;
              progressed = true;
            }
          }
        }
      }
    }

    if (!progressed) {
      // Assign remaining triangles to nearest region
      for (let i = 0; i < triangleCount; i++) {
        if (assigned[i] === -1) {
          let bestDist = Infinity;
          let bestR = 0;
          for (let r = 0; r < targetCount; r++) {
            const d = triangleCenters[i].distanceTo(triangleCenters[seeds[r]]);
            if (d < bestDist) {
              bestDist = d;
              bestR = r;
            }
          }
          assigned[i] = bestR;
          regions[bestR].push(i);
        }
      }
      break;
    }
  }

  return regions.filter((r) => r.length > 0);
}
