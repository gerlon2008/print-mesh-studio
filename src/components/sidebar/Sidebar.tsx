"use client";

import React, { useState } from "react";
import * as THREE from "three";
import { FolderOpen, Sparkles, Scissors, Palette, Download } from "lucide-react";
import { ImportTab } from "./ImportTab";
import { TripoSegmentationTab } from "./TripoSegmentationTab";
import { CuttingAndConnectorsTab } from "./CuttingAndConnectorsTab";
import { ColorSegmentationTab } from "./ColorSegmentationTab";
import { ExportTab } from "./ExportTab";
import { TripoDetectedPart, SegmentationTier } from "../../utils/tripoSegmentation";
import {
  CutPlaneConfig,
  ConnectorPin,
  SplitResultPart,
  ColorRegion,
  MeshStats,
  ActiveTool,
} from "../../types";

interface SidebarProps {
  activeTool: ActiveTool;
  setActiveTool: (tool: ActiveTool) => void;
  modelName: string;
  mainGeometry: THREE.BufferGeometry | null;
  detectedParts: TripoDetectedPart[];
  selectedPartId: string | null;
  onSelectPart: (id: string | null) => void;
  explodedDistance: number;
  onChangeExplodedDistance: (dist: number) => void;
  onRunTripoSegmentation: (tier: SegmentationTier) => void;
  onUpdatePartColor: (partId: string, col: string) => void;
  onTogglePartVisibility: (partId: string) => void;
  onGenerateConnectorsBetweenParts: () => void;
  onResetSegmentation: () => void;
  isProcessingTripo: boolean;
  splitParts: SplitResultPart[] | null;
  colorRegions: ColorRegion[];
  stats: MeshStats | null;
  cutConfig: CutPlaneConfig;
  onChangeCutConfig: (config: CutPlaneConfig) => void;
  pins: ConnectorPin[];
  onUpdatePins: (pins: ConnectorPin[]) => void;
  onExecuteCut: () => void;
  onResetCut: () => void;
  isProcessingCSG: boolean;
  activeColor: string;
  onChangeActiveColor: (col: string) => void;
  paintMode: "brush" | "flood";
  onChangePaintMode: (mode: "brush" | "flood") => void;
  floodAngleDeg: number;
  onChangeFloodAngle: (ang: number) => void;
  onRunKMeans: (k: number, nw: number, pw: number) => void;
  onUpdateRegionColor: (regId: string, col: string) => void;
  onToggleRegionVisibility: (regId: string) => void;
  onConvertToSubMeshes: () => void;
  isProcessingKMeans: boolean;
  onLoadGeometry: (geom: THREE.BufferGeometry, name: string) => void;
  isLoadingFile: boolean;
  setIsLoadingFile: (val: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = (props) => {
  const [activeTab, setActiveTab] = useState<"import" | "tripo" | "cut" | "color" | "export">("tripo");

  const handleTabChange = (tab: "import" | "tripo" | "cut" | "color" | "export") => {
    setActiveTab(tab);
    if (tab === "cut") props.setActiveTool("cut");
    else if (tab === "color") props.setActiveTool("paint");
    else props.setActiveTool("view");
  };

  return (
    <div className="w-88 md:w-96 h-full flex flex-col bg-zinc-950/95 border-l border-zinc-800 shrink-0 select-none">
      {/* 5-Tab Navigation Header */}
      <div className="grid grid-cols-5 border-b border-zinc-800 bg-zinc-900/60 p-1 gap-1 text-[10px]">
        <button
          onClick={() => handleTabChange("import")}
          className={`flex flex-col items-center gap-1 py-1.5 px-0.5 rounded font-medium transition-all ${
            activeTab === "import"
              ? "bg-zinc-800 text-zinc-100 shadow-sm"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
          }`}
          title="Importar modelo STL"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span>Modelo</span>
        </button>

        <button
          onClick={() => handleTabChange("tripo")}
          className={`flex flex-col items-center gap-1 py-1.5 px-0.5 rounded font-medium transition-all ${
            activeTab === "tripo"
              ? "bg-cyan-950/80 text-cyan-200 border border-cyan-800 shadow-sm"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
          }`}
          title="Detección de Partes (Tripo AI)"
        >
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>Partes IA</span>
        </button>

        <button
          onClick={() => handleTabChange("cut")}
          className={`flex flex-col items-center gap-1 py-1.5 px-0.5 rounded font-medium transition-all ${
            activeTab === "cut"
              ? "bg-red-950/70 text-red-200 border border-red-800/80 shadow-sm"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
          }`}
          title="Plano de Corte Slicer"
        >
          <Scissors className="w-3.5 h-3.5" />
          <span>Corte</span>
        </button>

        <button
          onClick={() => handleTabChange("color")}
          className={`flex flex-col items-center gap-1 py-1.5 px-0.5 rounded font-medium transition-all ${
            activeTab === "color"
              ? "bg-blue-950/70 text-blue-200 border border-blue-800/80 shadow-sm"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
          }`}
          title="Pintura Manual Smart Fill"
        >
          <Palette className="w-3.5 h-3.5" />
          <span>Pintar</span>
        </button>

        <button
          onClick={() => handleTabChange("export")}
          className={`flex flex-col items-center gap-1 py-1.5 px-0.5 rounded font-medium transition-all ${
            activeTab === "export"
              ? "bg-emerald-950/70 text-emerald-200 border border-emerald-800/80 shadow-sm"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
          }`}
          title="Exportar para Slicers 3D"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Exportar</span>
        </button>
      </div>

      {/* Tab Content Body */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "import" && (
          <ImportTab
            onLoadGeometry={props.onLoadGeometry}
            isLoading={props.isLoadingFile}
            setIsLoading={props.setIsLoadingFile}
          />
        )}

        {activeTab === "tripo" && (
          <TripoSegmentationTab
            detectedParts={props.detectedParts}
            selectedPartId={props.selectedPartId}
            onSelectPart={props.onSelectPart}
            explodedDistance={props.explodedDistance}
            onChangeExplodedDistance={props.onChangeExplodedDistance}
            onRunTripoSegmentation={props.onRunTripoSegmentation}
            onUpdatePartColor={props.onUpdatePartColor}
            onTogglePartVisibility={props.onTogglePartVisibility}
            onGenerateConnectorsBetweenParts={props.onGenerateConnectorsBetweenParts}
            onResetSegmentation={props.onResetSegmentation}
            isProcessing={props.isProcessingTripo}
            totalTriangles={props.stats?.triangleCount || 0}
          />
        )}

        {activeTab === "cut" && (
          <CuttingAndConnectorsTab
            stats={props.stats}
            cutConfig={props.cutConfig}
            onChangeCutConfig={props.onChangeCutConfig}
            pins={props.pins}
            onUpdatePins={props.onUpdatePins}
            onExecuteCut={props.onExecuteCut}
            onResetCut={props.onResetCut}
            isProcessingCSG={props.isProcessingCSG}
            hasSplitParts={!!props.splitParts && props.splitParts.length > 0}
          />
        )}

        {activeTab === "color" && (
          <ColorSegmentationTab
            colorRegions={props.colorRegions}
            activeColor={props.activeColor}
            onChangeActiveColor={props.onChangeActiveColor}
            paintMode={props.paintMode}
            onChangePaintMode={props.onChangePaintMode}
            floodAngleDeg={props.floodAngleDeg}
            onChangeFloodAngle={props.onChangeFloodAngle}
            onRunKMeans={props.onRunKMeans}
            onUpdateRegionColor={props.onUpdateRegionColor}
            onToggleRegionVisibility={props.onToggleRegionVisibility}
            onConvertToSubMeshes={props.onConvertToSubMeshes}
            isProcessingKMeans={props.isProcessingKMeans}
            totalTriangles={props.stats?.triangleCount || 0}
          />
        )}

        {activeTab === "export" && (
          <ExportTab
            modelName={props.modelName}
            mainGeometry={props.mainGeometry}
            splitParts={
              props.detectedParts.length > 0
                ? props.detectedParts.map((p) => ({
                    id: p.id,
                    name: p.name.replace(/\s+/g, "_"),
                    color: p.color,
                    geometry: p.geometry,
                    stats: p.stats,
                    visible: p.visible,
                  }))
                : props.splitParts
            }
            colorRegions={props.colorRegions}
            stats={props.stats}
          />
        )}
      </div>
    </div>
  );
};
