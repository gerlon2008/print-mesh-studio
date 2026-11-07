import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { ThreeMFLoader } from "three/examples/jsm/loaders/3MFLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { TripoDetectedPart, TRIPO_PALETTE } from "./tripoSegmentation";
import { computeMeshStats } from "./meshStats";

export interface ImportResult {
  fileName: string;
  fileType: "stl" | "3mf" | "obj";
  combinedGeometry: THREE.BufferGeometry;
  preSeparatedParts?: TripoDetectedPart[];
}

/**
 * Universal 3D Print File Importer supporting STL, 3MF and OBJ.
 * Centers model on build plate origin and rests base at Z=0.
 */
export async function import3DModelFile(file: File): Promise<ImportResult> {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "stl") {
    const buffer = await file.arrayBuffer();
    const loader = new STLLoader();
    const geometry = loader.parse(buffer);
    normalizeGeometry(geometry);

    return {
      fileName: file.name,
      fileType: "stl",
      combinedGeometry: geometry,
    };
  }

  if (extension === "3mf") {
    const buffer = await file.arrayBuffer();
    const loader = new ThreeMFLoader();
    const group = loader.parse(buffer);

    const extractedMeshes: THREE.Mesh[] = [];
    group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).geometry) {
        extractedMeshes.push(child as THREE.Mesh);
      }
    });

    if (extractedMeshes.length === 0) {
      throw new Error("El archivo 3MF no contiene mallas válidas.");
    }

    // Merge all meshes into a single combined geometry
    const combinedGeom = mergeMeshesIntoSingleGeometry(extractedMeshes);
    normalizeGeometry(combinedGeom);

    // If 3MF has multiple components, create pre-separated parts!
    let preSeparatedParts: TripoDetectedPart[] | undefined;
    if (extractedMeshes.length > 1) {
      preSeparatedParts = extractedMeshes.map((m, idx) => {
        const geom = m.geometry.clone().toNonIndexed();
        geom.computeVertexNormals();
        geom.computeBoundingBox();

        let partColor = TRIPO_PALETTE[idx % TRIPO_PALETTE.length];
        if (m.material) {
          const mat = Array.isArray(m.material) ? m.material[0] : m.material;
          if ((mat as THREE.MeshStandardMaterial).color) {
            partColor = `#${(mat as THREE.MeshStandardMaterial).color.getHexString()}`;
          }
        }

        const center = new THREE.Vector3();
        geom.boundingBox?.getCenter(center);
        const stats = computeMeshStats(geom);

        return {
          id: `3mf-part-${idx + 1}`,
          name: m.name || `Componente 3MF ${idx + 1}`,
          color: partColor,
          geometry: geom,
          stats,
          center,
          explosionVector: center.clone().normalize(),
          visible: true,
          selected: false,
          contactNeighborIds: [],
        };
      });
    }

    return {
      fileName: file.name,
      fileType: "3mf",
      combinedGeometry: combinedGeom,
      preSeparatedParts,
    };
  }

  if (extension === "obj") {
    const text = await file.text();
    const loader = new OBJLoader();
    const group = loader.parse(text);

    const extractedMeshes: THREE.Mesh[] = [];
    group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).geometry) {
        extractedMeshes.push(child as THREE.Mesh);
      }
    });

    if (extractedMeshes.length === 0) {
      throw new Error("El archivo OBJ no contiene mallas válidas.");
    }

    const combinedGeom = mergeMeshesIntoSingleGeometry(extractedMeshes);
    normalizeGeometry(combinedGeom);

    return {
      fileName: file.name,
      fileType: "obj",
      combinedGeometry: combinedGeom,
    };
  }

  throw new Error(`Formato .${extension} no soportado. Usa .stl, .3mf o .obj`);
}

/**
 * Normalizes geometry so its center is at (0, 0) and base is at Z = 0
 */
export function normalizeGeometry(geometry: THREE.BufferGeometry) {
  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox || new THREE.Box3();
  const center = new THREE.Vector3();
  bbox.getCenter(center);

  // Translate to center X/Y and put base at Z = 0
  geometry.translate(-center.x, -center.y, -bbox.min.z);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
}

/**
 * Merges multiple meshes into a single BufferGeometry
 */
function mergeMeshesIntoSingleGeometry(meshes: THREE.Mesh[]): THREE.BufferGeometry {
  if (meshes.length === 1) {
    return meshes[0].geometry.clone();
  }

  let totalVertices = 0;
  const nonIndexedList = meshes.map((m) => {
    const geom = m.geometry.clone().toNonIndexed();
    // Apply local mesh transform if present
    m.updateMatrixWorld(true);
    geom.applyMatrix4(m.matrixWorld);
    totalVertices += geom.getAttribute("position").count;
    return geom;
  });

  const mergedPositions = new Float32Array(totalVertices * 3);
  let offset = 0;

  for (const geom of nonIndexedList) {
    const pos = geom.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      mergedPositions[offset * 3] = pos.getX(i);
      mergedPositions[offset * 3 + 1] = pos.getY(i);
      mergedPositions[offset * 3 + 2] = pos.getZ(i);
      offset++;
    }
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.BufferAttribute(mergedPositions, 3));
  merged.computeVertexNormals();
  merged.computeBoundingBox();
  return merged;
}
