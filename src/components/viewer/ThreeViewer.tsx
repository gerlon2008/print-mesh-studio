"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { createBuildPlate } from "./BuildPlate";
import {
  ActiveTool,
  CutPlaneConfig,
  ConnectorPin,
  SplitResultPart,
  ColorRegion,
} from "../../types";
import { floodFillFaceSelection } from "../../utils/colorClustering";

interface ThreeViewerProps {
  mainGeometry: THREE.BufferGeometry | null;
  splitParts: SplitResultPart[] | null;
  colorRegions: ColorRegion[];
  activeTool: ActiveTool;
  cutConfig: CutPlaneConfig;
  pins: ConnectorPin[];
  explodedDistance: number;
  wireframe: boolean;
  activeColor: string;
  paintMode: "brush" | "flood";
  floodAngleDeg: number;
  onSelectTriangles?: (indices: number[]) => void;
  onAddPinAtPosition?: (pos: [number, number]) => void;
}

export const ThreeViewer: React.FC<ThreeViewerProps> = ({
  mainGeometry,
  splitParts,
  colorRegions,
  activeTool,
  cutConfig,
  pins,
  explodedDistance,
  wireframe,
  activeColor,
  paintMode,
  floodAngleDeg,
  onSelectTriangles,
  onAddPinAtPosition,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  
  // Dynamic 3D Objects
  const modelGroupRef = useRef<THREE.Group>(new THREE.Group());
  const cutPlaneMeshRef = useRef<THREE.Mesh | null>(null);
  const pinPreviewGroupRef = useRef<THREE.Group>(new THREE.Group());
  const buildPlateRef = useRef<THREE.Group | null>(null);

  const [mouseCoord, setMouseCoord] = useState<{ x: number; y: number } | null>(null);

  // Initialize Three.js Scene
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0e0e11);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
    camera.position.set(160, -180, 140);
    camera.up.set(0, 0, 1); // Z is UP for 3D printing
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxDistance = 1200;
    controls.minDistance = 10;
    controls.target.set(0, 0, 25);
    controlsRef.current = controls;

    // Lighting (Studio Setup for 3D printing slicer look)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x222230, 0.5);
    hemiLight.position.set(0, 0, 200);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(120, -140, 200);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 10;
    keyLight.shadow.camera.far = 600;
    const d = 160;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.4);
    fillLight.position.set(-150, 150, 80);
    scene.add(fillLight);

    // Build Plate
    const buildPlate = createBuildPlate(250);
    scene.add(buildPlate);
    buildPlateRef.current = buildPlate;

    // Model Group & Pin Preview Group
    scene.add(modelGroupRef.current);
    scene.add(pinPreviewGroupRef.current);

    // Render loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      container.innerHTML = "";
    };
  }, []);

  // Update Model Geometry & Materials
  useEffect(() => {
    const group = modelGroupRef.current;
    // Clear old meshes
    while (group.children.length > 0) {
      const child = group.children[0] as THREE.Mesh;
      group.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else child.material.dispose();
      }
    }

    // If we have split parts (after CSG cut)
    if (splitParts && splitParts.length > 0) {
      splitParts.forEach((part, index) => {
        if (!part.visible) return;

        const mat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(part.color),
          roughness: 0.35,
          metalness: 0.1,
          wireframe: wireframe,
        });

        const mesh = new THREE.Mesh(part.geometry, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.name = part.name;

        // Apply exploded view translation
        if (explodedDistance > 0) {
          // Push Part A along positive cut direction, Part B along negative
          const dir = index === 0 ? 1 : -1;
          let offsetVec = new THREE.Vector3(0, 0, dir * explodedDistance);
          if (cutConfig.axis === "x") offsetVec.set(dir * explodedDistance, 0, 0);
          if (cutConfig.axis === "y") offsetVec.set(0, dir * explodedDistance, 0);
          mesh.position.copy(offsetVec);
        }

        group.add(mesh);
      });
      return;
    }

    // Otherwise render main geometry
    if (!mainGeometry) return;

    let mat: THREE.Material;
    const hasVertexColors = mainGeometry.getAttribute("color") !== undefined;

    if (hasVertexColors) {
      mat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.35,
        metalness: 0.1,
        wireframe: wireframe,
      });
    } else {
      mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x38bdf8), // Cyan filament default
        roughness: 0.35,
        metalness: 0.1,
        wireframe: wireframe,
      });
    }

    const mainMesh = new THREE.Mesh(mainGeometry, mat);
    mainMesh.castShadow = true;
    mainMesh.receiveShadow = true;
    mainMesh.name = "mainModelMesh";
    group.add(mainMesh);

    // Auto center geometry if needed
    if (!mainGeometry.boundingBox) mainGeometry.computeBoundingBox();
  }, [mainGeometry, splitParts, colorRegions, wireframe, explodedDistance, cutConfig.axis]);

  // Update Cutting Plane Visualizer & Pin Previews
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Clean up previous cut plane
    if (cutPlaneMeshRef.current) {
      scene.remove(cutPlaneMeshRef.current);
      cutPlaneMeshRef.current.geometry.dispose();
      cutPlaneMeshRef.current = null;
    }

    // Clean up pin preview
    const pinGroup = pinPreviewGroupRef.current;
    while (pinGroup.children.length > 0) {
      const c = pinGroup.children[0] as THREE.Mesh;
      pinGroup.remove(c);
      if (c.geometry) c.geometry.dispose();
      if (c.material) (c.material as THREE.Material).dispose();
    }

    // Only render when cut tool or connectors tool is active and enabled
    if ((activeTool === "cut" || activeTool === "connectors") && cutConfig.enabled) {
      if (!mainGeometry) return;
      if (!mainGeometry.boundingBox) mainGeometry.computeBoundingBox();
      const bbox = mainGeometry.boundingBox || new THREE.Box3();
      const center = new THREE.Vector3();
      bbox.getCenter(center);
      const size = new THREE.Vector3();
      bbox.getSize(size);

      const planeExtent = Math.max(size.x, size.y, size.z) * 1.5;

      // Plane geometry
      const planeGeom = new THREE.PlaneGeometry(planeExtent, planeExtent);
      const planeMat = new THREE.MeshStandardMaterial({
        color: 0xef4444, // Red cutting sheet
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        depthWrite: false,
        roughness: 0.2,
      });

      const planeMesh = new THREE.Mesh(planeGeom, planeMat);
      planeMesh.name = "interactiveCutPlane";

      // Position plane
      const planePos = center.clone();
      if (cutConfig.axis === "x") {
        planePos.x += cutConfig.offset;
        planeMesh.rotation.y = Math.PI / 2;
      } else if (cutConfig.axis === "y") {
        planePos.y += cutConfig.offset;
        planeMesh.rotation.x = Math.PI / 2;
      } else {
        planePos.z += cutConfig.offset;
      }

      if (cutConfig.angle !== 0) {
        const rad = (cutConfig.angle * Math.PI) / 180;
        planeMesh.rotateZ(rad);
      }

      planeMesh.position.copy(planePos);

      // Frame outline
      const edges = new THREE.EdgesGeometry(planeGeom);
      const edgeLine = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: 0xf87171, linewidth: 2 })
      );
      planeMesh.add(edgeLine);

      scene.add(planeMesh);
      cutPlaneMeshRef.current = planeMesh;

      // Render connector pin previews on the plane
      pins.forEach((pin) => {
        // Male pin cylinder (cyan)
        const maleGeom = new THREE.CylinderGeometry(pin.radius, pin.radius, pin.height, 24);
        maleGeom.rotateX(Math.PI / 2);
        const maleMat = new THREE.MeshStandardMaterial({
          color: 0x06b6d4, // Cyan
          roughness: 0.3,
          wireframe: false,
        });
        const pinMesh = new THREE.Mesh(maleGeom, maleMat);
        pinMesh.position.set(pin.position[0], pin.position[1], 0);
        planeMesh.add(pinMesh);

        // Clearance socket ring indicator (amber)
        const socketRingGeom = new THREE.RingGeometry(
          pin.radius,
          pin.radius + pin.tolerance,
          24
        );
        const socketRingMat = new THREE.MeshBasicMaterial({
          color: 0xf59e0b,
          side: THREE.DoubleSide,
        });
        const ring = new THREE.Mesh(socketRingGeom, socketRingMat);
        ring.position.set(pin.position[0], pin.position[1], 0.05);
        planeMesh.add(ring);
      });
    }
  }, [activeTool, cutConfig, pins, mainGeometry]);

  // Handle Raycasting for Painting & Adding Connectors
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!containerRef.current || !cameraRef.current || !sceneRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);

      // 1. Tool Mode: Paint Triangles / Flood Fill
      if (activeTool === "paint" && mainGeometry && onSelectTriangles) {
        const mesh = modelGroupRef.current.getObjectByName("mainModelMesh") as THREE.Mesh;
        if (!mesh) return;

        const intersects = raycaster.intersectObject(mesh, false);
        if (intersects.length > 0 && typeof intersects[0].faceIndex === "number") {
          const hitFaceIndex = intersects[0].faceIndex;

          if (paintMode === "flood") {
            const connectedFaces = floodFillFaceSelection(
              mainGeometry,
              hitFaceIndex,
              floodAngleDeg
            );
            onSelectTriangles(connectedFaces);
          } else {
            // Single face or small neighborhood brush
            onSelectTriangles([hitFaceIndex]);
          }
        }
      }

      // 2. Tool Mode: Connector Placement by clicking on Cut Plane
      if (activeTool === "connectors" && cutPlaneMeshRef.current && onAddPinAtPosition) {
        const intersects = raycaster.intersectObject(cutPlaneMeshRef.current, false);
        if (intersects.length > 0) {
          const hitPoint = intersects[0].point;
          // Transform hitPoint into local coordinate of the plane
          const localPoint = cutPlaneMeshRef.current.worldToLocal(hitPoint.clone());
          onAddPinAtPosition([
            Number(localPoint.x.toFixed(2)),
            Number(localPoint.y.toFixed(2)),
          ]);
        }
      }
    },
    [activeTool, mainGeometry, paintMode, floodAngleDeg, onSelectTriangles, onAddPinAtPosition]
  );

  // Camera Presets
  const setCameraPreset = (view: "iso" | "top" | "front" | "side") => {
    if (!cameraRef.current || !controlsRef.current || !mainGeometry) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    if (!mainGeometry.boundingBox) mainGeometry.computeBoundingBox();
    const bbox = mainGeometry.boundingBox || new THREE.Box3();
    const center = new THREE.Vector3();
    bbox.getCenter(center);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z, 50);
    const dist = maxDim * 2.2;

    controls.target.copy(center);

    if (view === "iso") {
      camera.position.set(center.x + dist * 0.7, center.y - dist * 0.7, center.z + dist * 0.6);
    } else if (view === "top") {
      camera.position.set(center.x, center.y + 0.01, center.z + dist);
    } else if (view === "front") {
      camera.position.set(center.x, center.y - dist, center.z);
    } else if (view === "side") {
      camera.position.set(center.x + dist, center.y, center.z);
    }

    camera.lookAt(center);
    controls.update();
  };

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-zinc-950">
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* Floating Camera View Gizmo & Reset buttons */}
      <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-zinc-900/80 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-zinc-800 text-xs shadow-lg">
        <span className="text-zinc-400 font-mono text-[11px] mr-1">Vistas:</span>
        <button
          onClick={() => setCameraPreset("iso")}
          className="px-2 py-0.5 rounded hover:bg-zinc-800 text-zinc-200 transition-colors"
          title="Vista Isométrica"
        >
          ISO
        </button>
        <button
          onClick={() => setCameraPreset("top")}
          className="px-2 py-0.5 rounded hover:bg-zinc-800 text-zinc-200 transition-colors"
          title="Vista Superior"
        >
          TOP
        </button>
        <button
          onClick={() => setCameraPreset("front")}
          className="px-2 py-0.5 rounded hover:bg-zinc-800 text-zinc-200 transition-colors"
          title="Vista Frontal"
        >
          FRONT
        </button>
        <button
          onClick={() => setCameraPreset("side")}
          className="px-2 py-0.5 rounded hover:bg-zinc-800 text-zinc-200 transition-colors"
          title="Vista Lateral"
        >
          SIDE
        </button>
      </div>

      {/* Interaction Mode Overlay Hint */}
      {activeTool === "paint" && (
        <div className="absolute top-3 right-3 bg-blue-950/80 border border-blue-800/80 text-blue-200 px-3 py-1.5 rounded-lg text-xs backdrop-blur-md flex items-center gap-2 shadow-lg">
          <div
            className="w-3 h-3 rounded-full border border-white/50"
            style={{ backgroundColor: activeColor }}
          />
          <span>
            {paintMode === "flood"
              ? "Modo Relleno: Haz clic en una cara para pintar la región contigua"
              : "Modo Pincel: Haz clic para asignar color al triángulo"}
          </span>
        </div>
      )}

      {activeTool === "connectors" && (
        <div className="absolute top-3 right-3 bg-amber-950/80 border border-amber-800/80 text-amber-200 px-3 py-1.5 rounded-lg text-xs backdrop-blur-md shadow-lg flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span>Haz clic sobre el plano de corte rojo para ubicar un conector</span>
        </div>
      )}

      {/* Plate size reference badge */}
      <div className="absolute bottom-3 left-3 bg-zinc-900/70 backdrop-blur-sm px-2.5 py-1 rounded-md text-[10px] text-zinc-400 font-mono border border-zinc-800/60">
        Cama: 250 × 250 mm | Z-Up
      </div>
    </div>
  );
};
