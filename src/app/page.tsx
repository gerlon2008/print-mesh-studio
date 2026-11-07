"use client";

import React, { useState, useEffect, useCallback } from "react";
import * as THREE from "three";
import { Box, Layers, Sparkles, HelpCircle } from "lucide-react";
import { ThreeViewer } from "../components/viewer/ThreeViewer";
import { Toolbar } from "../components/ui/Toolbar";
import { StatsBadge } from "../components/ui/StatsBadge";
import { Sidebar } from "../components/sidebar/Sidebar";
import {
  ActiveTool,
  CutPlaneConfig,
  ConnectorPin,
  SplitResultPart,
  ColorRegion,
  MeshStats,
} from "../types";
import { computeMeshStats } from "../utils/meshStats";
import {
  clusterMeshByKMeans,
  applyColorsToGeometry,
  splitGeometryIntoSubMeshes,
  DEFAULT_PALETTE,
} from "../utils/colorClustering";
import { cutMeshWithPlane, applyConnectorsToParts } from "../utils/csgCutting";
import { createMechanicalTestPiece } from "../utils/sampleModels";

export default function Home() {
  // Model state
  const [modelName, setModelName] = useState<string>("Pieza_Mecanica_Test.stl");
  const [mainGeometry, setMainGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [originalGeometry, setOriginalGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [stats, setStats] = useState<MeshStats | null>(null);

  // Tools & View state
  const [activeTool, setActiveTool] = useState<ActiveTool>("view");
  const [wireframe, setWireframe] = useState<boolean>(false);
  const [explodedDistance, setExplodedDistance] = useState<number>(0);

  // CSG Cut & Connectors state
  const [cutConfig, setCutConfig] = useState<CutPlaneConfig>({
    axis: "z",
    offset: 10,
    angle: 0,
    enabled: true,
    visualize: true,
  });
  const [pins, setPins] = useState<ConnectorPin[]>([
    {
      id: "pin-1",
      type: "cylinder",
      radius: 2.5,
      height: 8.0,
      tolerance: 0.2,
      position: [-10, 0],
    },
    {
      id: "pin-2",
      type: "cylinder",
      radius: 2.5,
      height: 8.0,
      tolerance: 0.2,
      position: [10, 0],
    },
  ]);
  const [splitParts, setSplitParts] = useState<SplitResultPart[] | null>(null);
  const [isProcessingCSG, setIsProcessingCSG] = useState<boolean>(false);

  // Color Segmentation state
  const [colorRegions, setColorRegions] = useState<ColorRegion[]>([]);
  const [activeColor, setActiveColor] = useState<string>(DEFAULT_PALETTE[0]);
  const [paintMode, setPaintMode] = useState<"brush" | "flood">("flood");
  const [floodAngleDeg, setFloodAngleDeg] = useState<number>(30);
  const [isProcessingKMeans, setIsProcessingKMeans] = useState<boolean>(false);

  // Loading state
  const [isLoadingFile, setIsLoadingFile] = useState<boolean>(false);

  // Initialize with procedural sample piece on mount
  useEffect(() => {
    const sampleGeom = createMechanicalTestPiece();
    const meshStats = computeMeshStats(sampleGeom);
    setMainGeometry(sampleGeom.clone());
    setOriginalGeometry(sampleGeom.clone());
    setStats(meshStats);
  }, []);

  // Handler for loaded/created geometries
  const handleLoadGeometry = useCallback((geom: THREE.BufferGeometry, name: string) => {
    setModelName(name);
    setMainGeometry(geom.clone());
    setOriginalGeometry(geom.clone());
    setSplitParts(null);
    setColorRegions([]);
    setExplodedDistance(0);
    const newStats = computeMeshStats(geom);
    setStats(newStats);

    // Adjust cut offset default to center
    setCutConfig((prev) => ({
      ...prev,
      offset: 0,
    }));
  }, []);

  // Execute CSG boolean cut with pin/socket generation
  const handleExecuteCut = useCallback(() => {
    const targetGeom = originalGeometry || mainGeometry;
    if (!targetGeom) return;

    setIsProcessingCSG(true);

    setTimeout(() => {
      try {
        // 1. Cut mesh in two solid halves using CSG
        const cutResult = cutMeshWithPlane(targetGeom, cutConfig);

        // 2. Add male pins and female cavity sockets with tolerance clearance
        const finalParts = applyConnectorsToParts(
          cutResult.partA,
          cutResult.partB,
          cutResult,
          pins
        );

        // 3. Store split parts with individual stats
        const partAStats = computeMeshStats(finalParts.partA);
        const partBStats = computeMeshStats(finalParts.partB);

        const meshA = new THREE.Mesh(finalParts.partA);
        const meshB = new THREE.Mesh(finalParts.partB);

        setSplitParts([
          {
            id: "part-top-male",
            name: "Parte_Superior_PinesMacho",
            color: "#06b6d4", // Cyan
            geometry: finalParts.partA,
            mesh: meshA,
            stats: partAStats,
            visible: true,
          },
          {
            id: "part-bottom-female",
            name: "Parte_Inferior_CajasHembra",
            color: "#f59e0b", // Amber
            geometry: finalParts.partB,
            mesh: meshB,
            stats: partBStats,
            visible: true,
          },
        ]);

        // Auto apply initial exploded offset so user sees the cut and pins
        setExplodedDistance(15);
      } catch (err) {
        console.error("CSG Boolean operation failed:", err);
      } finally {
        setIsProcessingCSG(false);
      }
    }, 50);
  }, [originalGeometry, mainGeometry, cutConfig, pins]);

  // Reset Cut
  const handleResetCut = () => {
    setSplitParts(null);
    setExplodedDistance(0);
    if (originalGeometry) {
      setMainGeometry(originalGeometry.clone());
    }
  };

  // Run AI K-Means Color Segmentation
  const handleRunKMeans = useCallback(
    (k: number, nw: number, pw: number) => {
      if (!mainGeometry) return;
      setIsProcessingKMeans(true);

      setTimeout(() => {
        try {
          const regions = clusterMeshByKMeans(mainGeometry, k, nw, pw);
          setColorRegions(regions);

          // Apply vertex colors to visualize in 3D
          const coloredGeom = applyColorsToGeometry(mainGeometry, regions);
          setMainGeometry(coloredGeom);
        } catch (err) {
          console.error("K-Means clustering failed:", err);
        } finally {
          setIsProcessingKMeans(false);
        }
      }, 50);
    },
    [mainGeometry]
  );

  // Paint / Select Triangles via 3D Raycasting
  const handleSelectTriangles = useCallback(
    (triangleIndices: number[]) => {
      if (!mainGeometry || triangleIndices.length === 0) return;

      // Find or create region for the active color
      let existingRegion = colorRegions.find((r) => r.color === activeColor);
      let newRegions = [...colorRegions];

      if (!existingRegion) {
        existingRegion = {
          id: "region-" + (colorRegions.length + 1),
          name: `Color ${colorRegions.length + 1}`,
          color: activeColor,
          triangleIndices: [],
          visible: true,
        };
        newRegions.push(existingRegion);
      }

      // Add indices avoiding duplicates
      const currentIndices = new Set(existingRegion.triangleIndices);
      triangleIndices.forEach((idx) => currentIndices.add(idx));
      existingRegion.triangleIndices = Array.from(currentIndices);

      // Remove from any other regions if conflicting
      newRegions = newRegions.map((reg) => {
        if (reg.id === existingRegion!.id) return existingRegion!;
        return {
          ...reg,
          triangleIndices: reg.triangleIndices.filter((idx) => !currentIndices.has(idx)),
        };
      });

      setColorRegions(newRegions);

      // Re-apply vertex colors
      const coloredGeom = applyColorsToGeometry(mainGeometry, newRegions);
      setMainGeometry(coloredGeom);
    },
    [mainGeometry, colorRegions, activeColor]
  );

  // Add pin by clicking on plane
  const handleAddPinAtPosition = (pos: [number, number]) => {
    const currentTolerance = pins.length > 0 ? pins[0].tolerance : 0.2;
    const newPin: ConnectorPin = {
      id: "pin-" + Date.now(),
      type: "cylinder",
      radius: 2.5,
      height: 8.0,
      tolerance: currentTolerance,
      position: pos,
    };
    setPins([...pins, newPin]);
  };

  // Convert color regions into sub-meshes
  const handleConvertToSubMeshes = () => {
    if (!mainGeometry || colorRegions.length === 0) return;
    const subMeshes = splitGeometryIntoSubMeshes(mainGeometry, colorRegions);

    const newSplitParts: SplitResultPart[] = subMeshes.map((sub, i) => {
      const pStats = computeMeshStats(sub.geometry);
      return {
        id: sub.region.id,
        name: sub.region.name.replace(/\s+/g, "_"),
        color: sub.region.color,
        geometry: sub.geometry,
        mesh: new THREE.Mesh(sub.geometry),
        stats: pStats,
        visible: sub.region.visible,
      };
    });

    setSplitParts(newSplitParts);
  };

  const handleUpdateRegionColor = (regionId: string, newColor: string) => {
    const updated = colorRegions.map((r) =>
      r.id === regionId ? { ...r, color: newColor } : r
    );
    setColorRegions(updated);
    if (mainGeometry) {
      const coloredGeom = applyColorsToGeometry(mainGeometry, updated);
      setMainGeometry(coloredGeom);
    }
  };

  const handleToggleRegionVisibility = (regionId: string) => {
    const updated = colorRegions.map((r) =>
      r.id === regionId ? { ...r, visible: !r.visible } : r
    );
    setColorRegions(updated);
    if (mainGeometry) {
      const coloredGeom = applyColorsToGeometry(mainGeometry, updated);
      setMainGeometry(coloredGeom);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-zinc-950 font-sans">
      {/* Top Application Header */}
      <header className="h-11 px-4 flex items-center justify-between bg-zinc-900 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-sm">
              <Box className="w-4 h-4" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-bold text-sm tracking-tight text-white">PrintMesh</span>
              <span className="text-[10px] font-mono uppercase bg-cyan-950 border border-cyan-800 text-cyan-300 px-1.5 py-0.2 rounded font-semibold">
                Studio 3D
              </span>
            </div>
          </div>
          <span className="text-zinc-600">|</span>
          <span className="text-xs text-zinc-400 font-mono truncate max-w-xs">{modelName}</span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="hidden sm:flex items-center gap-2 text-[11px] text-zinc-400 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>WebGL 2.0 / CSG Engine</span>
          </div>

          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Ayuda Slicer</span>
          </a>
        </div>
      </header>

      {/* Main Studio Workspace */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left / Center 3D Viewport Column */}
        <div className="flex-1 flex flex-col h-full overflow-hidden relative">
          {/* Action Toolbar */}
          <Toolbar
            activeTool={activeTool}
            onSelectTool={setActiveTool}
            wireframe={wireframe}
            onToggleWireframe={() => setWireframe((v) => !v)}
            hasSplitParts={!!splitParts && splitParts.length > 0}
            explodedDistance={explodedDistance}
            onChangeExplodedDistance={setExplodedDistance}
          />

          {/* Three.js Interactive Canvas */}
          <div className="flex-1 relative overflow-hidden">
            <ThreeViewer
              mainGeometry={mainGeometry}
              splitParts={splitParts}
              colorRegions={colorRegions}
              activeTool={activeTool}
              cutConfig={cutConfig}
              pins={pins}
              explodedDistance={explodedDistance}
              wireframe={wireframe}
              activeColor={activeColor}
              paintMode={paintMode}
              floodAngleDeg={floodAngleDeg}
              onSelectTriangles={handleSelectTriangles}
              onAddPinAtPosition={handleAddPinAtPosition}
            />
          </div>

          {/* Bottom Mesh Stats Bar */}
          <StatsBadge stats={stats} modelName={modelName} />
        </div>

        {/* Right Sidebar Control Panel */}
        <Sidebar
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          modelName={modelName}
          mainGeometry={mainGeometry}
          splitParts={splitParts}
          colorRegions={colorRegions}
          stats={stats}
          cutConfig={cutConfig}
          onChangeCutConfig={setCutConfig}
          pins={pins}
          onUpdatePins={setPins}
          onExecuteCut={handleExecuteCut}
          onResetCut={handleResetCut}
          isProcessingCSG={isProcessingCSG}
          activeColor={activeColor}
          onChangeActiveColor={setActiveColor}
          paintMode={paintMode}
          onChangePaintMode={setPaintMode}
          floodAngleDeg={floodAngleDeg}
          onChangeFloodAngle={setFloodAngleDeg}
          onRunKMeans={handleRunKMeans}
          onUpdateRegionColor={handleUpdateRegionColor}
          onToggleRegionVisibility={handleToggleRegionVisibility}
          onConvertToSubMeshes={handleConvertToSubMeshes}
          isProcessingKMeans={isProcessingKMeans}
          onLoadGeometry={handleLoadGeometry}
          isLoadingFile={isLoadingFile}
          setIsLoadingFile={setIsLoadingFile}
        />
      </div>
    </div>
  );
}
