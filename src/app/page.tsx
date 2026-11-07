"use client";

import React, { useState, useEffect, useCallback } from "react";
import * as THREE from "three";
import { Box, Sparkles, HelpCircle, Layers, Sliders } from "lucide-react";
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
import {
  detectPartsTripoStyle,
  TripoDetectedPart,
  SegmentationTier,
} from "../utils/tripoSegmentation";
import { generateDowelBetweenParts } from "../utils/jointConnectorGenerator";

export default function Home() {
  // Model state
  const [modelName, setModelName] = useState<string>("Pieza_Mecanica_Test.stl");
  const [mainGeometry, setMainGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [originalGeometry, setOriginalGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [stats, setStats] = useState<MeshStats | null>(null);

  // Tripo AI Part Detection State
  const [detectedParts, setDetectedParts] = useState<TripoDetectedPart[]>([]);
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [isProcessingTripo, setIsProcessingTripo] = useState<boolean>(false);

  // Tools & View state
  const [activeTool, setActiveTool] = useState<ActiveTool>("view");
  const [wireframe, setWireframe] = useState<boolean>(false);
  const [explodedDistance, setExplodedDistance] = useState<number>(0);

  // CSG Cut & Connectors state
  const [cutConfig, setCutConfig] = useState<CutPlaneConfig>({
    axis: "z",
    offset: 10,
    angle: 0,
    liveClipping: false,
  });
  const [pins, setPins] = useState<ConnectorPin[]>([]);
  const [splitParts, setSplitParts] = useState<SplitResultPart[] | null>(null);
  const [isProcessingCSG, setIsProcessingCSG] = useState<boolean>(false);

  // Color Segmentation state
  const [colorRegions, setColorRegions] = useState<ColorRegion[]>([]);
  const [activeColor, setActiveColor] = useState<string>(DEFAULT_PALETTE[0]);
  const [paintMode, setPaintMode] = useState<"brush" | "flood">("brush");
  const [floodAngleDeg, setFloodAngleDeg] = useState<number>(30);
  const [brushSizeMm, setBrushSizeMm] = useState<number>(6);
  const [isProcessingKMeans, setIsProcessingKMeans] = useState<boolean>(false);

  // Loading state
  const [isLoadingFile, setIsLoadingFile] = useState<boolean>(false);

  // Initialize with procedural benchmark piece on mount
  useEffect(() => {
    const sampleGeom = createMechanicalTestPiece();
    const meshStats = computeMeshStats(sampleGeom);
    setMainGeometry(sampleGeom.clone());
    setOriginalGeometry(sampleGeom.clone());
    setStats(meshStats);

    // Auto-run Tripo detection on initial load for instant wow factor!
    const parts = detectPartsTripoStyle(sampleGeom, "balanced");
    setDetectedParts(parts);
    setExplodedDistance(18); // Show subtle exploded view right away
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

    // Run Tripo detection on newly uploaded mesh
    const parts = detectPartsTripoStyle(geom, "balanced");
    setDetectedParts(parts);
    if (parts.length > 1) {
      setExplodedDistance(15);
    }
  }, []);

  // Run Tripo AI style segmentation
  const handleRunTripoSegmentation = useCallback(
    (tier: SegmentationTier) => {
      const targetGeom = originalGeometry || mainGeometry;
      if (!targetGeom) return;

      setIsProcessingTripo(true);
      setTimeout(() => {
        try {
          const parts = detectPartsTripoStyle(targetGeom, tier);
          setDetectedParts(parts);
          setExplodedDistance(20); // Automatically trigger exploded view
        } catch (err) {
          console.error("Tripo segmentation failed:", err);
        } finally {
          setIsProcessingTripo(false);
        }
      }, 60);
    },
    [originalGeometry, mainGeometry]
  );

  const handleUpdatePartColor = (partId: string, newColor: string) => {
    setDetectedParts((prev) =>
      prev.map((p) => (p.id === partId ? { ...p, color: newColor } : p))
    );
  };

  const handleTogglePartVisibility = (partId: string) => {
    setDetectedParts((prev) =>
      prev.map((p) => (p.id === partId ? { ...p, visible: !p.visible } : p))
    );
  };

  const handleResetSegmentation = () => {
    setDetectedParts([]);
    setExplodedDistance(0);
    setSelectedPartId(null);
    if (originalGeometry) {
      setMainGeometry(originalGeometry.clone());
    }
  };

  // Generate dowel connector pins between neighboring detected parts
  const handleGenerateConnectorsBetweenParts = useCallback(() => {
    if (detectedParts.length < 2) return;

    try {
      // Pick the first two prominent adjacent parts
      const partA = detectedParts[0];
      const partB = detectedParts[1];

      const res = generateDowelBetweenParts(partA, partB, 4.0, 10.0, 0.2);

      const dowelStats = computeMeshStats(res.dowelGeometry);
      const dowelPart: TripoDetectedPart = {
        id: `dowel-${Date.now()}`,
        name: "Pasador de Ensamble (Dowel 3D)",
        color: "#ffffff",
        geometry: res.dowelGeometry,
        stats: dowelStats,
        center: res.dowelPosition,
        explosionVector: new THREE.Vector3(0, 0, 1),
        visible: true,
        selected: false,
        contactNeighborIds: [partA.id, partB.id],
      };

      setDetectedParts((prev) => [
        ...prev.map((p) => {
          if (p.id === partA.id) return { ...p, geometry: res.updatedPartA };
          if (p.id === partB.id) return { ...p, geometry: res.updatedPartB };
          return p;
        }),
        dowelPart,
      ]);
    } catch (err) {
      console.error("Connector generation failed:", err);
    }
  }, [detectedParts]);

  // Execute CSG boolean cut
  const handleExecuteCut = useCallback(() => {
    const targetGeom = originalGeometry || mainGeometry;
    if (!targetGeom) return;

    setIsProcessingCSG(true);

    setTimeout(() => {
      try {
        const cutResult = cutMeshWithPlane(targetGeom, {
          axis: cutConfig.axis,
          offset: cutConfig.offset,
          angle: cutConfig.angle,
          enabled: true,
          visualize: true,
        });

        const partAStats = computeMeshStats(cutResult.partA);
        const partBStats = computeMeshStats(cutResult.partB);

        setSplitParts([
          {
            id: "part-top-male",
            name: "Parte_Superior_Corte",
            color: "#06b6d4",
            geometry: cutResult.partA,
            stats: partAStats,
            visible: true,
          },
          {
            id: "part-bottom-female",
            name: "Parte_Inferior_Corte",
            color: "#f59e0b",
            geometry: cutResult.partB,
            stats: partBStats,
            visible: true,
          },
        ]);

        setExplodedDistance(25);
      } catch (err) {
        console.error("CSG cut failed:", err);
      } finally {
        setIsProcessingCSG(false);
      }
    }, 50);
  }, [originalGeometry, mainGeometry, cutConfig]);

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

  // Paint Triangles
  const handlePaintTriangles = useCallback(
    (triangleIndices: number[]) => {
      if (!mainGeometry || triangleIndices.length === 0) return;

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

      const currentIndices = new Set(existingRegion.triangleIndices);
      triangleIndices.forEach((idx) => currentIndices.add(idx));
      existingRegion.triangleIndices = Array.from(currentIndices);

      setColorRegions(newRegions);
      const coloredGeom = applyColorsToGeometry(mainGeometry, newRegions);
      setMainGeometry(coloredGeom);
    },
    [mainGeometry, colorRegions, activeColor]
  );

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
          {detectedParts.length > 0 && (
            <div className="flex items-center gap-1.5 bg-cyan-950/80 border border-cyan-800/80 px-2 py-0.5 rounded text-[11px] text-cyan-300 font-mono">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span>{detectedParts.length} Partes Tripo Detectadas</span>
            </div>
          )}

          <div className="hidden sm:flex items-center gap-2 text-[11px] text-zinc-400 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>WebGL 2.0 / CSG Engine</span>
          </div>

          <a
            href="https://github.com/gerlon2008/print-mesh-studio"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span className="hidden md:inline">GitHub</span>
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
            hasSplitParts={detectedParts.length > 0 || (!!splitParts && splitParts.length > 0)}
            explodedDistance={explodedDistance}
            onChangeExplodedDistance={setExplodedDistance}
          />

          {/* Three.js Interactive Canvas */}
          <div className="flex-1 relative overflow-hidden">
            <ThreeViewer
              mainGeometry={mainGeometry}
              detectedParts={detectedParts}
              selectedPartId={selectedPartId}
              onSelectPart={setSelectedPartId}
              explodedDistance={explodedDistance}
              activeTool={activeTool}
              cutConfig={cutConfig}
              wireframe={wireframe}
              activeFilamentColor={activeColor}
              brushSizeMm={brushSizeMm}
              paintMode={paintMode}
              smartFillAngleDeg={floodAngleDeg}
              onPaintTriangles={handlePaintTriangles}
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
          detectedParts={detectedParts}
          selectedPartId={selectedPartId}
          onSelectPart={setSelectedPartId}
          explodedDistance={explodedDistance}
          onChangeExplodedDistance={setExplodedDistance}
          onRunTripoSegmentation={handleRunTripoSegmentation}
          onUpdatePartColor={handleUpdatePartColor}
          onTogglePartVisibility={handleTogglePartVisibility}
          onGenerateConnectorsBetweenParts={handleGenerateConnectorsBetweenParts}
          onResetSegmentation={handleResetSegmentation}
          isProcessingTripo={isProcessingTripo}
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
