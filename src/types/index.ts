import * as THREE from "three";

export interface MeshStats {
  vertexCount: number;
  triangleCount: number;
  dimensions: {
    x: number;
    y: number;
    z: number;
  };
  volumeCm3: number;
  surfaceAreaCm2: number;
  boundingBox: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  };
}

export interface ColorRegion {
  id: string;
  name: string;
  color: string;
  triangleIndices: number[]; // Index into face triplets
  visible: boolean;
}

export interface CutPlaneConfig {
  axis: "x" | "y" | "z";
  offset: number; // In mm, relative to center
  angle: number;  // Rotation in degrees
  enabled: boolean;
  visualize: boolean;
}

export interface ConnectorPin {
  id: string;
  type: "cylinder" | "dowel" | "square";
  radius: number;     // mm
  height: number;     // mm
  tolerance: number;  // mm (0.15 - 0.3mm typical for FDM)
  position: [number, number]; // 2D position along cut plane (u, v)
}

export interface SplitResultPart {
  id: string;
  name: string;
  color: string;
  geometry: THREE.BufferGeometry;
  mesh?: THREE.Mesh;
  stats: MeshStats;
  visible: boolean;
}

export type ActiveTool = "view" | "cut" | "paint" | "connectors" | "inspect";
