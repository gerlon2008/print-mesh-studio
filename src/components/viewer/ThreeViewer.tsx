"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { createBuildPlate } from "./BuildPlate";
import { TripoDetectedPart } from "../../utils/tripoSegmentation";
import { CutPlaneConfig, ActiveTool } from "../../types";

interface ThreeViewerProps {
  mainGeometry: THREE.BufferGeometry | null;
  detectedParts: TripoDetectedPart[];
  splitParts: { id: string; name: string; color: string; geometry: THREE.BufferGeometry; visible: boolean }[] | null;
  selectedPartId: string | null;
  onSelectPart: (id: string | null) => void;
  explodedDistance: number;
  activeTool: ActiveTool;
  cutConfig: CutPlaneConfig;
  wireframe: boolean;
  activeFilamentColor: string;
  brushSizeMm: number;
  paintMode: "brush" | "flood" | "bucket";
  smartFillAngleDeg: number;
  onPaintTriangles?: (faceIndices: number[]) => void;
}

export const ThreeViewer: React.FC<ThreeViewerProps> = ({
  mainGeometry,
  detectedParts,
  splitParts,
  selectedPartId,
  onSelectPart,
  explodedDistance,
  activeTool,
  cutConfig,
  wireframe,
  activeFilamentColor,
  brushSizeMm,
  paintMode,
  smartFillAngleDeg,
  onPaintTriangles,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  // Groups
  const partsGroupRef = useRef<THREE.Group>(new THREE.Group());
  const singleModelGroupRef = useRef<THREE.Group>(new THREE.Group());
  const brushCursorMeshRef = useRef<THREE.Mesh | null>(null);
  const cutPlaneVisualRef = useRef<THREE.Mesh | null>(null);
  const buildPlateGroupRef = useRef<THREE.Group | null>(null);

  // Interaction State
  const [showPlate, setShowPlate] = useState<boolean>(false); // Default OFF as requested by user
  const [hoveredPartId, setHoveredPartId] = useState<string | null>(null);
  const isPointerDownRef = useRef(false);

  // Initialize Scene
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x09090b); // Zinc-950
    sceneRef.current = scene;

    // Camera (Z-Up for 3D Printing)
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 3000);
    camera.position.set(160, -180, 140);
    camera.up.set(0, 0, 1);
    cameraRef.current = camera;

    // Renderer with ACES tone mapping & shadow maps
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.localClippingEnabled = true;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0, 25);
    controlsRef.current = controls;

    // Lighting (Bambu Studio / Tripo Studio Look)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x18181b, 0.6);
    hemiLight.position.set(0, 0, 250);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
    keyLight.position.set(140, -150, 220);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.bias = -0.0005;
    const d = 160;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.4);
    rimLight.position.set(-160, 160, 100);
    scene.add(rimLight);

    // Build Plate (floor grid, optional)
    const buildPlate = createBuildPlate(250);
    buildPlate.visible = false; // Default OFF
    scene.add(buildPlate);
    buildPlateGroupRef.current = buildPlate;

    // Add containers
    scene.add(partsGroupRef.current);
    scene.add(singleModelGroupRef.current);

    // 3D Brush Cursor Ring (for Paint mode)
    const ringGeom = new THREE.RingGeometry(0.5, 1.0, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const brushCursor = new THREE.Mesh(ringGeom, ringMat);
    brushCursor.visible = false;
    scene.add(brushCursor);
    brushCursorMeshRef.current = brushCursor;

    // Animation Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

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

  // Sync Floor Grid Visibility
  useEffect(() => {
    if (buildPlateGroupRef.current) {
      buildPlateGroupRef.current.visible = showPlate;
    }
  }, [showPlate]);

  // Auto-Frame camera on loaded model and position floor at true base
  useEffect(() => {
    if (!mainGeometry) return;
    if (!mainGeometry.boundingBox) mainGeometry.computeBoundingBox();
    const bbox = mainGeometry.boundingBox || new THREE.Box3();
    const center = new THREE.Vector3();
    bbox.getCenter(center);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z, 40);

    if (controlsRef.current && cameraRef.current) {
      controlsRef.current.target.copy(center);
      cameraRef.current.position.set(
        center.x + maxDim * 1.4,
        center.y - maxDim * 1.4,
        center.z + maxDim * 1.1
      );
      cameraRef.current.lookAt(center);
      controlsRef.current.update();
    }

    if (buildPlateGroupRef.current) {
      // Place grid strictly at the true bottom of the model
      buildPlateGroupRef.current.position.set(center.x, center.y, bbox.min.z);
    }
  }, [mainGeometry]);

  // Update Rendered Meshes (Tripo Parts vs Single Model)
  useEffect(() => {
    const partsGroup = partsGroupRef.current;
    const singleGroup = singleModelGroupRef.current;

    // Clear previous
    while (partsGroup.children.length > 0) {
      partsGroup.remove(partsGroup.children[0]);
    }
    while (singleGroup.children.length > 0) {
      singleGroup.remove(singleGroup.children[0]);
    }

    // 1. If CSG Cut Parts are active: Render split parts with male pins and sockets!
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
        mesh.userData = { partId: part.id };

        if (explodedDistance > 0) {
          const dir = index === 0 ? 1 : -1;
          let offsetVec = new THREE.Vector3(0, 0, dir * explodedDistance);
          if (cutConfig.axis === "x") offsetVec.set(dir * explodedDistance, 0, 0);
          if (cutConfig.axis === "y") offsetVec.set(0, dir * explodedDistance, 0);
          mesh.position.copy(offsetVec);
        }

        partsGroup.add(mesh);
      });
      return;
    }

    // 2. If Tripo AI parts are detected: Render individual modular parts with exploded offsets!
    if (detectedParts.length > 0) {
      detectedParts.forEach((part) => {
        if (!part.visible) return;

        const isSelected = part.id === selectedPartId;
        const isHovered = part.id === hoveredPartId;
        const isDowel = part.id.startsWith("dowel");

        const mat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(part.color),
          roughness: isDowel ? 0.2 : 0.35,
          metalness: isDowel ? 0.3 : 0.1,
          wireframe: wireframe,
          emissive: isSelected
            ? new THREE.Color(0x38bdf8)
            : isHovered
            ? new THREE.Color(0x27272a)
            : isDowel
            ? new THREE.Color(0x422006) // subtle warm glow for dowels
            : new THREE.Color(0x000000),
          emissiveIntensity: isSelected ? 0.45 : isHovered ? 0.25 : 0.3,
        });

        const mesh = new THREE.Mesh(part.geometry, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = { partId: part.id };

        // Apply Tripo-style radial exploded view translation
        if (explodedDistance > 0 && !isDowel) {
          const offsetVec = part.explosionVector.clone().multiplyScalar(explodedDistance);
          mesh.position.copy(offsetVec);
        }

        partsGroup.add(mesh);
      });
      return;
    }

    // 2. Otherwise render single base model
    if (!mainGeometry) return;

    const hasColors = mainGeometry.getAttribute("color") !== undefined;
    const mat = new THREE.MeshStandardMaterial({
      color: hasColors ? undefined : new THREE.Color(0x38bdf8),
      vertexColors: hasColors,
      roughness: 0.35,
      metalness: 0.1,
      wireframe: wireframe,
    });

    const mesh = new THREE.Mesh(mainGeometry, mat);
    mesh.name = "mainModelMesh";
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    singleGroup.add(mesh);
  }, [detectedParts, selectedPartId, hoveredPartId, explodedDistance, mainGeometry, wireframe]);

  // Update Cutting Plane Visualizer
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (cutPlaneVisualRef.current) {
      scene.remove(cutPlaneVisualRef.current);
      cutPlaneVisualRef.current.geometry.dispose();
      cutPlaneVisualRef.current = null;
    }

    if (activeTool === "cut" && mainGeometry) {
      if (!mainGeometry.boundingBox) mainGeometry.computeBoundingBox();
      const bbox = mainGeometry.boundingBox || new THREE.Box3();
      const center = new THREE.Vector3();
      bbox.getCenter(center);
      const size = new THREE.Vector3();
      bbox.getSize(size);
      const span = Math.max(size.x, size.y, size.z) * 1.5;

      const planeGeom = new THREE.PlaneGeometry(span, span);
      const planeMat = new THREE.MeshStandardMaterial({
        color: 0xf43f5e, // Rose red
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        roughness: 0.2,
      });

      const planeMesh = new THREE.Mesh(planeGeom, planeMat);
      const p = center.clone();
      if (cutConfig.axis === "x") {
        p.x += cutConfig.offset;
        planeMesh.rotation.y = Math.PI / 2;
      } else if (cutConfig.axis === "y") {
        p.y += cutConfig.offset;
        planeMesh.rotation.x = Math.PI / 2;
      } else {
        p.z += cutConfig.offset;
      }
      planeMesh.position.copy(p);

      const wire = new THREE.LineSegments(
        new THREE.EdgesGeometry(planeGeom),
        new THREE.LineBasicMaterial({ color: 0xfb7185, linewidth: 2 })
      );
      planeMesh.add(wire);

      scene.add(planeMesh);
      cutPlaneVisualRef.current = planeMesh;
    }
  }, [activeTool, cutConfig, mainGeometry]);

  // Raycasting Handler (Click to Select Tripo Part, or Paint Triangles)
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!containerRef.current || !cameraRef.current || !sceneRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);

      // 1. In Paint Mode: Update 3D Brush cursor ring and continuously paint if pointer is down
      if (activeTool === "paint" && brushCursorMeshRef.current) {
        const singleGroup = singleModelGroupRef.current;
        const mainMesh = singleGroup.getObjectByName("mainModelMesh") as THREE.Mesh;
        if (mainMesh) {
          const intersects = raycaster.intersectObject(mainMesh, false);
          if (intersects.length > 0) {
            const hit = intersects[0];
            const cursor = brushCursorMeshRef.current;
            cursor.visible = true;
            cursor.position.copy(hit.point).addScaledVector(hit.normal!, 0.3);
            cursor.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), hit.normal!);
            cursor.scale.set(brushSizeMm, brushSizeMm, 1);

            // If mouse button is held down, continuously paint faces
            if (isPointerDownRef.current && onPaintTriangles && typeof hit.faceIndex === "number") {
              onPaintTriangles([hit.faceIndex]);
            }
            return;
          }
        }
        brushCursorMeshRef.current.visible = false;
        return;
      }

      if (brushCursorMeshRef.current) {
        brushCursorMeshRef.current.visible = false;
      }

      // 2. In Tripo Parts Mode: Hover detection
      if (detectedParts.length > 0) {
        const intersects = raycaster.intersectObjects(partsGroupRef.current.children, false);
        if (intersects.length > 0) {
          const partId = intersects[0].object.userData.partId;
          if (partId && partId !== hoveredPartId) {
            setHoveredPartId(partId);
          }
        } else if (hoveredPartId) {
          setHoveredPartId(null);
        }
      }
    },
    [activeTool, detectedParts, hoveredPartId, brushSizeMm, onPaintTriangles]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      isPointerDownRef.current = true;
      if (!containerRef.current || !cameraRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);

      // 1. Tripo Part Selection by clicking in 3D
      if (detectedParts.length > 0 && activeTool !== "paint") {
        const intersects = raycaster.intersectObjects(partsGroupRef.current.children, false);
        if (intersects.length > 0) {
          const partId = intersects[0].object.userData.partId;
          onSelectPart(partId || null);
          return;
        } else {
          onSelectPart(null);
        }
      }

      // 2. Painting single click / smart fill
      if (activeTool === "paint" && onPaintTriangles) {
        const singleGroup = singleModelGroupRef.current;
        const mainMesh = singleGroup.getObjectByName("mainModelMesh") as THREE.Mesh;
        if (mainMesh) {
          const intersects = raycaster.intersectObject(mainMesh, false);
          if (intersects.length > 0 && typeof intersects[0].faceIndex === "number") {
            onPaintTriangles([intersects[0].faceIndex]);
          }
        }
      }
    },
    [detectedParts, activeTool, onSelectPart, onPaintTriangles]
  );

  const handlePointerUp = () => {
    isPointerDownRef.current = false;
  };

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
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* Camera View Controls */}
      <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-zinc-900/85 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-zinc-800 text-xs shadow-lg">
        <span className="text-zinc-500 font-mono text-[10px] mr-1">Vistas:</span>
        {(["iso", "top", "front", "side"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setCameraPreset(v)}
            className="px-2 py-0.5 rounded hover:bg-zinc-800 text-zinc-300 font-mono text-[11px] uppercase transition-colors"
          >
            {v}
          </button>
        ))}
        <span className="text-zinc-700 mx-1">|</span>
        <button
          onClick={() => setShowPlate((prev) => !prev)}
          className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
            showPlate
              ? "bg-cyan-950 text-cyan-300 border border-cyan-800"
              : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
          }`}
          title="Alternar visibilidad de la cuadrícula de suelo"
        >
          {showPlate ? "Plancha: ON" : "Plancha: OFF"}
        </button>
      </div>

      {/* Exploded View Floating Indicator (Tripo AI Style) */}
      {detectedParts.length > 0 && explodedDistance > 0 && (
        <div className="absolute top-3 right-3 bg-cyan-950/80 border border-cyan-800 text-cyan-200 px-3 py-1.5 rounded-lg text-xs backdrop-blur-md shadow-lg flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span>Despiece 3D Activo: {explodedDistance} mm</span>
        </div>
      )}

      {/* Floor Grid reference (only when enabled) */}
      {showPlate && (
        <div className="absolute bottom-3 left-3 bg-zinc-900/70 backdrop-blur-sm px-2.5 py-1 rounded-md text-[10px] text-zinc-400 font-mono border border-zinc-800/60">
          Cuadrícula Base: 250 × 250 mm
        </div>
      )}
    </div>
  );
};
