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
  triangleIndices: number[];
  visible: boolean;
}

export interface FilamentSlot {
  id: number; // 1, 2, 3, 4 (AMS slot number)
  name: string;
  colorHex: string;
  materialType: string; // "PLA Basic", "PETG", "Matte", etc.
}

export type PaintToolMode = "brush" | "bucket" | "facet";

export interface PaintConfig {
  mode: PaintToolMode;
  activeSlot: number; // 1 to 8
  brushSizeMm: number; // 1 to 30mm
  smartFillAngleDeg: number; // 5 to 60 deg
}

export interface CutPlaneConfig {
  axis: "z" | "y" | "x";
  offset: number; // In mm relative to bounding box center
  angle: number; // Rotation in degrees
  enabled?: boolean;
  visualize?: boolean;
  liveClipping?: boolean;
}

export type ConnectorStyle = "dowel" | "plug"; // Dowel = separate printable pin (recommended in Bambu Studio)

export interface ConnectorPin {
  id: string;
  type?: "cylinder" | "dowel" | "square";
  style?: ConnectorStyle;
  shape?: "cylinder" | "square";
  radius: number;     // mm
  height: number;     // mm
  diameterMm?: number;
  depthMm?: number;
  tolerance: number;  // mm
  toleranceMm?: number;
  position: [number, number];
  position2D?: [number, number];
}

export interface SplitResultPart {
  id: string;
  name: string;
  color: string;
  geometry: THREE.BufferGeometry;
  mesh?: THREE.Mesh;
  stats: MeshStats;
  visible: boolean;
  isDowelPin?: boolean;
}

export type ActiveTool = "view" | "cut" | "paint" | "connectors" | "inspect";
