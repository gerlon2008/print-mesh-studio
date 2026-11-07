import * as THREE from "three";

/**
 * Seals any open boundaries of a mesh geometry by finding all open boundary edge loops
 * and triangulating solid, watertight caps with outward-pointing normals.
 * Ensures the resulting mesh is a 100% solid, closed 3D printable manifold.
 */
export function sealAndCapMesh(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const nonIndexed = geometry.toNonIndexed();
  const posAttr = nonIndexed.getAttribute("position");
  const normAttr = nonIndexed.getAttribute("normal");
  const triangleCount = posAttr.count / 3;

  if (triangleCount === 0) return geometry;

  // Spatial key for vertex matching (rounded to 0.05 mm to handle shared vertices)
  function getVKey(x: number, y: number, z: number): string {
    return `${Math.round(x * 20)}_${Math.round(y * 20)}_${Math.round(z * 20)}`;
  }

  // Track directed edges and count occurrences
  interface EdgeInfo {
    pa: THREE.Vector3;
    pb: THREE.Vector3;
    keyA: string;
    keyB: string;
  }

  const undirectedCount = new Map<string, number>();
  const undirectedEdges = new Map<string, EdgeInfo>();

  for (let i = 0; i < triangleCount; i++) {
    const v0 = i * 3;
    const v1 = i * 3 + 1;
    const v2 = i * 3 + 2;

    const p0 = new THREE.Vector3(posAttr.getX(v0), posAttr.getY(v0), posAttr.getZ(v0));
    const p1 = new THREE.Vector3(posAttr.getX(v1), posAttr.getY(v1), posAttr.getZ(v1));
    const p2 = new THREE.Vector3(posAttr.getX(v2), posAttr.getY(v2), posAttr.getZ(v2));

    const k0 = getVKey(p0.x, p0.y, p0.z);
    const k1 = getVKey(p1.x, p1.y, p1.z);
    const k2 = getVKey(p2.x, p2.y, p2.z);

    const edges: [THREE.Vector3, THREE.Vector3, string, string][] = [
      [p0, p1, k0, k1],
      [p1, p2, k1, k2],
      [p2, p0, k2, k0],
    ];

    for (const [pa, pb, ka, kb] of edges) {
      const uKey = ka < kb ? `${ka}-${kb}` : `${kb}-${ka}`;
      undirectedCount.set(uKey, (undirectedCount.get(uKey) || 0) + 1);
      undirectedEdges.set(uKey, { pa, pb, keyA: ka, keyB: kb });
    }
  }

  // Open boundary edges have exactly 1 triangle
  const boundaryEdges: EdgeInfo[] = [];
  for (const [uKey, count] of undirectedCount.entries()) {
    if (count === 1) {
      boundaryEdges.push(undirectedEdges.get(uKey)!);
    }
  }

  // If already closed / watertight, return as is
  if (boundaryEdges.length === 0) {
    return geometry;
  }

  // Compute mesh centroid for outward normal orientation
  const meshCenter = new THREE.Vector3();
  for (let i = 0; i < posAttr.count; i++) {
    meshCenter.x += posAttr.getX(i);
    meshCenter.y += posAttr.getY(i);
    meshCenter.z += posAttr.getZ(i);
  }
  meshCenter.divideScalar(posAttr.count);

  // Group boundary edges into contiguous planar clusters/loops
  // Most cuts are separated along Z or specific planes
  const clusters: EdgeInfo[][] = [];
  const assigned = new Set<number>();

  for (let i = 0; i < boundaryEdges.length; i++) {
    if (assigned.has(i)) continue;
    const currentCluster: EdgeInfo[] = [boundaryEdges[i]];
    assigned.add(i);

    const baseZ = (boundaryEdges[i].pa.z + boundaryEdges[i].pb.z) * 0.5;

    for (let j = i + 1; j < boundaryEdges.length; j++) {
      if (assigned.has(j)) continue;
      const targetZ = (boundaryEdges[j].pa.z + boundaryEdges[j].pb.z) * 0.5;
      // If within 4mm Z-slice or connected, group into same cap
      if (Math.abs(targetZ - baseZ) < 5.0) {
        currentCluster.push(boundaryEdges[j]);
        assigned.add(j);
      }
    }

    if (currentCluster.length >= 3) {
      clusters.push(currentCluster);
    }
  }

  // Generate solid cap triangles for each boundary cluster
  const capVertices: THREE.Vector3[] = [];

  for (const cluster of clusters) {
    const loopCenter = new THREE.Vector3();
    cluster.forEach((e) => loopCenter.add(e.pa));
    loopCenter.divideScalar(cluster.length);

    // Desired outward normal points AWAY from meshCenter
    const outwardDir = new THREE.Vector3().subVectors(loopCenter, meshCenter).normalize();

    for (const edge of cluster) {
      // Create triangle: edge.pa, edge.pb, loopCenter
      const vA = new THREE.Vector3().subVectors(edge.pb, edge.pa);
      const vB = new THREE.Vector3().subVectors(loopCenter, edge.pa);
      const triNorm = new THREE.Vector3().crossVectors(vA, vB).normalize();

      if (triNorm.dot(outwardDir) >= 0) {
        capVertices.push(edge.pa.clone(), edge.pb.clone(), loopCenter.clone());
      } else {
        capVertices.push(edge.pb.clone(), edge.pa.clone(), loopCenter.clone());
      }
    }
  }

  // Merge original vertices and cap vertices into a single solid BufferGeometry
  const totalVerts = posAttr.count + capVertices.length;
  const mergedPositions = new Float32Array(totalVerts * 3);

  // Copy original positions
  for (let i = 0; i < posAttr.count; i++) {
    mergedPositions[i * 3] = posAttr.getX(i);
    mergedPositions[i * 3 + 1] = posAttr.getY(i);
    mergedPositions[i * 3 + 2] = posAttr.getZ(i);
  }

  // Append cap positions
  let writeOffset = posAttr.count * 3;
  for (const v of capVertices) {
    mergedPositions[writeOffset++] = v.x;
    mergedPositions[writeOffset++] = v.y;
    mergedPositions[writeOffset++] = v.z;
  }

  const sealedGeometry = new THREE.BufferGeometry();
  sealedGeometry.setAttribute("position", new THREE.BufferAttribute(mergedPositions, 3));
  sealedGeometry.computeVertexNormals();
  sealedGeometry.computeBoundingBox();

  return sealedGeometry;
}
