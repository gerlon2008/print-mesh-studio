import * as THREE from "three";
import { ColorRegion } from "../types";

export const DEFAULT_PALETTE = [
  "#3b82f6", // Blue
  "#ef4444", // Red
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#f97316", // Orange
  "#64748b", // Slate
  "#e2e8f0", // White/Light
];

interface TriangleFeature {
  index: number;
  // Normalized features: nx, ny, nz (normals) and px, py, pz (normalized position)
  nx: number;
  ny: number;
  nz: number;
  px: number;
  py: number;
  pz: number;
}

/**
 * K-Means clustering on mesh triangles combining surface normals and spatial positions.
 * This effectively segments the model into semantic parts (e.g. top features, sides, base, details).
 */
export function clusterMeshByKMeans(
  geometry: THREE.BufferGeometry,
  k: number = 4,
  weightNormal: number = 0.65,
  weightPos: number = 0.35,
  maxIterations: number = 15
): ColorRegion[] {
  // Ensure non-indexed geometry or handle indexed geometry
  const posAttr = geometry.getAttribute("position");
  if (!posAttr) return [];

  // Compute vertex normals if missing
  if (!geometry.getAttribute("normal")) {
    geometry.computeVertexNormals();
  }
  const normAttr = geometry.getAttribute("normal");
  const indexAttr = geometry.getIndex();
  const triangleCount = indexAttr ? indexAttr.count / 3 : posAttr.count / 3;

  if (triangleCount === 0) return [];

  // Bounding box for position normalization
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const bbox = geometry.boundingBox || new THREE.Box3();
  const size = new THREE.Vector3();
  bbox.getSize(size);
  const min = bbox.min;

  const sx = size.x > 0 ? 1 / size.x : 1;
  const sy = size.y > 0 ? 1 / size.y : 1;
  const sz = size.z > 0 ? 1 / size.z : 1;

  // Extract triangle features
  const features: TriangleFeature[] = new Array(triangleCount);
  const pA = new THREE.Vector3();
  const pB = new THREE.Vector3();
  const pC = new THREE.Vector3();
  const nA = new THREE.Vector3();
  const nB = new THREE.Vector3();
  const nC = new THREE.Vector3();
  const faceNormal = new THREE.Vector3();
  const faceCenter = new THREE.Vector3();
  const edge1 = new THREE.Vector3();
  const edge2 = new THREE.Vector3();

  for (let i = 0; i < triangleCount; i++) {
    let i0 = i * 3;
    let i1 = i * 3 + 1;
    let i2 = i * 3 + 2;

    if (indexAttr) {
      i0 = indexAttr.getX(i0);
      i1 = indexAttr.getX(i1);
      i2 = indexAttr.getX(i2);
    }

    pA.fromBufferAttribute(posAttr, i0);
    pB.fromBufferAttribute(posAttr, i1);
    pC.fromBufferAttribute(posAttr, i2);

    // Compute geometric face normal from edges for accuracy
    edge1.subVectors(pB, pA);
    edge2.subVectors(pC, pA);
    faceNormal.crossVectors(edge1, edge2).normalize();

    // Fallback to vertex normal if degenerate
    if (isNaN(faceNormal.x) && normAttr) {
      nA.fromBufferAttribute(normAttr, i0);
      nB.fromBufferAttribute(normAttr, i1);
      nC.fromBufferAttribute(normAttr, i2);
      faceNormal.addVectors(nA, nB).add(nC).normalize();
    }

    // Face center
    faceCenter.set(
      (pA.x + pB.x + pC.x) / 3,
      (pA.y + pB.y + pC.y) / 3,
      (pA.z + pB.z + pC.z) / 3
    );

    // Normalize coordinates to [0, 1]
    features[i] = {
      index: i,
      nx: faceNormal.x,
      ny: faceNormal.y,
      nz: faceNormal.z,
      px: (faceCenter.x - min.x) * sx,
      py: (faceCenter.y - min.y) * sy,
      pz: (faceCenter.z - min.z) * sz,
    };
  }

  // Initialize K centroids (spread out using K-means++ heuristic)
  const actualK = Math.min(k, triangleCount);
  const centroids: TriangleFeature[] = [];

  // Pick first centroid randomly
  centroids.push({ ...features[Math.floor(Math.random() * triangleCount)] });

  const distSq = (f1: TriangleFeature, f2: TriangleFeature) => {
    const dnx = f1.nx - f2.nx;
    const dny = f1.ny - f2.ny;
    const dnz = f1.nz - f2.nz;
    const dpx = f1.px - f2.px;
    const dpy = f1.py - f2.py;
    const dpz = f1.pz - f2.pz;
    return (
      weightNormal * (dnx * dnx + dny * dny + dnz * dnz) +
      weightPos * (dpx * dpx + dpy * dpy + dpz * dpz)
    );
  };

  // Pick remaining centroids with probability proportional to distance
  while (centroids.length < actualK) {
    let bestCandidate = features[0];
    let maxDist = -1;
    const sampleStep = Math.max(1, Math.floor(triangleCount / 200));

    for (let i = 0; i < triangleCount; i += sampleStep) {
      const feat = features[i];
      let minDistToCentroids = Infinity;
      for (const c of centroids) {
        const d = distSq(feat, c);
        if (d < minDistToCentroids) minDistToCentroids = d;
      }
      if (minDistToCentroids > maxDist) {
        maxDist = minDistToCentroids;
        bestCandidate = feat;
      }
    }
    centroids.push({ ...bestCandidate });
  }

  // Cluster assignment array
  const assignments = new Int32Array(triangleCount);

  // Iterations
  for (let iter = 0; iter < maxIterations; iter++) {
    let changed = 0;

    // Assignment step
    for (let i = 0; i < triangleCount; i++) {
      const f = features[i];
      let bestDist = Infinity;
      let bestCluster = 0;

      for (let c = 0; c < actualK; c++) {
        const d = distSq(f, centroids[c]);
        if (d < bestDist) {
          bestDist = d;
          bestCluster = c;
        }
      }

      if (assignments[i] !== bestCluster) {
        assignments[i] = bestCluster;
        changed++;
      }
    }

    if (changed === 0 && iter > 1) break;

    // Update centroids
    const counts = new Int32Array(actualK);
    const sumNx = new Float64Array(actualK);
    const sumNy = new Float64Array(actualK);
    const sumNz = new Float64Array(actualK);
    const sumPx = new Float64Array(actualK);
    const sumPy = new Float64Array(actualK);
    const sumPz = new Float64Array(actualK);

    for (let i = 0; i < triangleCount; i++) {
      const c = assignments[i];
      const f = features[i];
      counts[c]++;
      sumNx[c] += f.nx;
      sumNy[c] += f.ny;
      sumNz[c] += f.nz;
      sumPx[c] += f.px;
      sumPy[c] += f.py;
      sumPz[c] += f.pz;
    }

    for (let c = 0; c < actualK; c++) {
      if (counts[c] > 0) {
        const inv = 1 / counts[c];
        centroids[c].nx = sumNx[c] * inv;
        centroids[c].ny = sumNy[c] * inv;
        centroids[c].nz = sumNz[c] * inv;
        centroids[c].px = sumPx[c] * inv;
        centroids[c].py = sumPy[c] * inv;
        centroids[c].pz = sumPz[c] * inv;
      }
    }
  }

  // Group triangle indices by cluster
  const clusters: number[][] = Array.from({ length: actualK }, () => []);
  for (let i = 0; i < triangleCount; i++) {
    clusters[assignments[i]].push(i);
  }

  // Filter out empty clusters and build ColorRegion array
  const regions: ColorRegion[] = [];
  let colorIndex = 0;

  for (let c = 0; c < actualK; c++) {
    if (clusters[c].length === 0) continue;
    regions.push({
      id: `region-${c + 1}`,
      name: `Color Segmento ${colorIndex + 1}`,
      color: DEFAULT_PALETTE[colorIndex % DEFAULT_PALETTE.length],
      triangleIndices: clusters[c],
      visible: true,
    });
    colorIndex++;
  }

  return regions;
}

/**
 * Flood-fill selection from a starting triangle based on normal coplanarity.
 * Useful for selecting text, embossed logos, or flat planar faces with one click.
 */
export function floodFillFaceSelection(
  geometry: THREE.BufferGeometry,
  startTriangleIdx: number,
  angleThresholdDeg: number = 25
): number[] {
  const posAttr = geometry.getAttribute("position");
  if (!posAttr) return [];

  const indexAttr = geometry.getIndex();
  const triangleCount = indexAttr ? indexAttr.count / 3 : posAttr.count / 3;
  if (startTriangleIdx < 0 || startTriangleIdx >= triangleCount) return [];

  const cosThreshold = Math.cos((angleThresholdDeg * Math.PI) / 180);

  // Compute normals for all triangles
  const normals: THREE.Vector3[] = new Array(triangleCount);
  const pA = new THREE.Vector3();
  const pB = new THREE.Vector3();
  const pC = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();

  // Also build adjacency graph by edge or vertex
  // Map vertex coordinate key -> list of triangle indices
  const vertexToTriangles: Map<string, number[]> = new Map();

  const getVertexKey = (x: number, y: number, z: number) => {
    // Round to 0.05 mm to handle shared vertices even if not indexed
    return `${Math.round(x * 20)},${Math.round(y * 20)},${Math.round(z * 20)}`;
  };

  for (let i = 0; i < triangleCount; i++) {
    let i0 = i * 3;
    let i1 = i * 3 + 1;
    let i2 = i * 3 + 2;

    if (indexAttr) {
      i0 = indexAttr.getX(i0);
      i1 = indexAttr.getX(i1);
      i2 = indexAttr.getX(i2);
    }

    pA.fromBufferAttribute(posAttr, i0);
    pB.fromBufferAttribute(posAttr, i1);
    pC.fromBufferAttribute(posAttr, i2);

    e1.subVectors(pB, pA);
    e2.subVectors(pC, pA);
    const n = new THREE.Vector3().crossVectors(e1, e2).normalize();
    normals[i] = n;

    const k0 = getVertexKey(pA.x, pA.y, pA.z);
    const k1 = getVertexKey(pB.x, pB.y, pB.z);
    const k2 = getVertexKey(pC.x, pC.y, pC.z);

    for (const k of [k0, k1, k2]) {
      const list = vertexToTriangles.get(k);
      if (list) list.push(i);
      else vertexToTriangles.set(k, [i]);
    }
  }

  const selectedSet = new Set<number>();
  const queue: number[] = [startTriangleIdx];
  selectedSet.add(startTriangleIdx);

  const seedNormal = normals[startTriangleIdx];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const currNormal = normals[curr];

    // Find neighboring triangles through shared vertices
    let i0 = curr * 3;
    let i1 = curr * 3 + 1;
    let i2 = curr * 3 + 2;
    if (indexAttr) {
      i0 = indexAttr.getX(i0);
      i1 = indexAttr.getX(i1);
      i2 = indexAttr.getX(i2);
    }

    pA.fromBufferAttribute(posAttr, i0);
    pB.fromBufferAttribute(posAttr, i1);
    pC.fromBufferAttribute(posAttr, i2);

    const keys = [
      getVertexKey(pA.x, pA.y, pA.z),
      getVertexKey(pB.x, pB.y, pB.z),
      getVertexKey(pC.x, pC.y, pC.z),
    ];

    for (const key of keys) {
      const neighbors = vertexToTriangles.get(key) || [];
      for (const nIdx of neighbors) {
        if (!selectedSet.has(nIdx)) {
          const nNormal = normals[nIdx];
          // Check dot product against current and seed normal
          if (
            currNormal.dot(nNormal) >= cosThreshold &&
            seedNormal.dot(nNormal) >= cosThreshold - 0.1
          ) {
            selectedSet.add(nIdx);
            queue.push(nIdx);
          }
        }
      }
    }
  }

  return Array.from(selectedSet);
}

/**
 * Creates vertex color buffer attribute on geometry to visualize color segments
 */
export function applyColorsToGeometry(
  geometry: THREE.BufferGeometry,
  regions: ColorRegion[],
  baseColorHex: string = "#71717a"
): THREE.BufferGeometry {
  const clone = geometry.toNonIndexed(); // Working with non-indexed makes per-triangle coloring exact
  const posAttr = clone.getAttribute("position");
  const triangleCount = posAttr.count / 3;

  const colorAttr = new Float32Array(posAttr.count * 3);
  const baseColor = new THREE.Color(baseColorHex);

  // Fill default color
  for (let i = 0; i < posAttr.count; i++) {
    colorAttr[i * 3] = baseColor.r;
    colorAttr[i * 3 + 1] = baseColor.g;
    colorAttr[i * 3 + 2] = baseColor.b;
  }

  // Map each region color
  const tempColor = new THREE.Color();
  for (const reg of regions) {
    if (!reg.visible) continue;
    tempColor.set(reg.color);

    for (const triIdx of reg.triangleIndices) {
      if (triIdx < triangleCount) {
        const vStart = triIdx * 3;
        for (let v = 0; v < 3; v++) {
          const vert = vStart + v;
          colorAttr[vert * 3] = tempColor.r;
          colorAttr[vert * 3 + 1] = tempColor.g;
          colorAttr[vert * 3 + 2] = tempColor.b;
        }
      }
    }
  }

  clone.setAttribute("color", new THREE.BufferAttribute(colorAttr, 3));
  return clone;
}

/**
 * Separates a single geometry into multiple geometries according to ColorRegions
 */
export function splitGeometryIntoSubMeshes(
  geometry: THREE.BufferGeometry,
  regions: ColorRegion[]
): { region: ColorRegion; geometry: THREE.BufferGeometry }[] {
  const nonIndexed = geometry.toNonIndexed();
  const posAttr = nonIndexed.getAttribute("position");
  const normAttr = nonIndexed.getAttribute("normal");
  const uvAttr = nonIndexed.getAttribute("uv");

  const results: { region: ColorRegion; geometry: THREE.BufferGeometry }[] = [];

  for (const reg of regions) {
    if (reg.triangleIndices.length === 0) continue;

    const count = reg.triangleIndices.length * 3;
    const newPositions = new Float32Array(count * 3);
    const newNormals = normAttr ? new Float32Array(count * 3) : null;
    const newUvs = uvAttr ? new Float32Array(count * 2) : null;

    let writeIdx = 0;
    for (const tri of reg.triangleIndices) {
      const vStart = tri * 3;
      for (let v = 0; v < 3; v++) {
        const srcV = vStart + v;
        const dstV = writeIdx;

        newPositions[dstV * 3] = posAttr.getX(srcV);
        newPositions[dstV * 3 + 1] = posAttr.getY(srcV);
        newPositions[dstV * 3 + 2] = posAttr.getZ(srcV);

        if (newNormals && normAttr) {
          newNormals[dstV * 3] = normAttr.getX(srcV);
          newNormals[dstV * 3 + 1] = normAttr.getY(srcV);
          newNormals[dstV * 3 + 2] = normAttr.getZ(srcV);
        }

        if (newUvs && uvAttr) {
          newUvs[dstV * 2] = uvAttr.getX(srcV);
          newUvs[dstV * 2 + 1] = uvAttr.getY(srcV);
        }

        writeIdx++;
      }
    }

    const subGeom = new THREE.BufferGeometry();
    subGeom.setAttribute("position", new THREE.BufferAttribute(newPositions, 3));
    if (newNormals) {
      subGeom.setAttribute("normal", new THREE.BufferAttribute(newNormals, 3));
    } else {
      subGeom.computeVertexNormals();
    }
    if (newUvs) {
      subGeom.setAttribute("uv", new THREE.BufferAttribute(newUvs, 2));
    }
    subGeom.computeBoundingBox();

    results.push({
      region: reg,
      geometry: subGeom,
    });
  }

  return results;
}
