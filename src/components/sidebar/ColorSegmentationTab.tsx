"use client";

import React, { useState } from "react";
import { Sparkles, Palette, Eye, EyeOff, Check, Paintbrush, Pipette, Layers } from "lucide-react";
import { ColorRegion } from "../../types";
import { DEFAULT_PALETTE } from "../../utils/colorClustering";

interface ColorSegmentationTabProps {
  colorRegions: ColorRegion[];
  activeColor: string;
  onChangeActiveColor: (color: string) => void;
  paintMode: "brush" | "flood";
  onChangePaintMode: (mode: "brush" | "flood") => void;
  floodAngleDeg: number;
  onChangeFloodAngle: (angle: number) => void;
  onRunKMeans: (k: number, normalWeight: number, posWeight: number) => void;
  onUpdateRegionColor: (regionId: string, newColor: string) => void;
  onToggleRegionVisibility: (regionId: string) => void;
  onConvertToSubMeshes: () => void;
  isProcessingKMeans: boolean;
  totalTriangles: number;
}

export const ColorSegmentationTab: React.FC<ColorSegmentationTabProps> = ({
  colorRegions,
  activeColor,
  onChangeActiveColor,
  paintMode,
  onChangePaintMode,
  floodAngleDeg,
  onChangeFloodAngle,
  onRunKMeans,
  onUpdateRegionColor,
  onToggleRegionVisibility,
  onConvertToSubMeshes,
  isProcessingKMeans,
  totalTriangles,
}) => {
  const [clusterK, setClusterK] = useState(3);
  const [normalWeight, setNormalWeight] = useState(0.65);

  return (
    <div className="space-y-5 text-xs">
      <div>
        <div className="flex items-center gap-1.5 text-zinc-100 font-semibold text-sm">
          <Palette className="w-4 h-4 text-blue-400" />
          <span>Separación Multicolor & Segmentación</span>
        </div>
        <p className="text-zinc-400 text-[11px] mt-0.5">
          Agrupa partes de la pieza por color para imprimir en slicers con soporte multi-filamento
          (Bambu Studio AMS, OrcaSlicer, Prusa MMU).
        </p>
      </div>

      {/* AI / Algorithmic K-Means Clustering */}
      <div className="bg-zinc-900/60 p-3 rounded-xl border border-zinc-800 space-y-3">
        <div className="flex items-center gap-1.5 font-medium text-zinc-200">
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          <span>Segmentación Algorítmica (K-Means)</span>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-zinc-300">
            <span>Número de Colores (Clusters K):</span>
            <span className="font-mono text-purple-400 font-semibold">{clusterK} colores</span>
          </div>
          <input
            type="range"
            min="2"
            max="6"
            step="1"
            value={clusterK}
            onChange={(e) => setClusterK(Number(e.target.value))}
            className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
          />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-zinc-300">
            <span>Ponderación: Normales vs Posición</span>
            <span className="font-mono text-zinc-400">
              {Math.round(normalWeight * 100)}% / {Math.round((1 - normalWeight) * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0.1"
            max="0.9"
            step="0.05"
            value={normalWeight}
            onChange={(e) => setNormalWeight(Number(e.target.value))}
            className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <div className="flex justify-between text-[9px] text-zinc-500">
            <span>Orientación geométrica</span>
            <span>Ubicación espacial</span>
          </div>
        </div>

        <button
          onClick={() => onRunKMeans(clusterK, normalWeight, 1 - normalWeight)}
          disabled={isProcessingKMeans}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium shadow-sm transition-all disabled:opacity-50 cursor-pointer"
        >
          {isProcessingKMeans ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Analizando Malla con K-Means...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span>Segmentar Automáticamente con K-Means</span>
            </>
          )}
        </button>
      </div>

      {/* Manual Face Painting & Flood Fill Mode */}
      <div className="space-y-3">
        <label className="text-zinc-200 font-medium">Modo de Selección en Modelo 3D:</label>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onChangePaintMode("flood")}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border font-medium transition-colors ${
              paintMode === "flood"
                ? "bg-blue-950/80 border-blue-600 text-blue-200"
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Pipette className="w-3.5 h-3.5" />
            <span>Relleno Inteligente</span>
          </button>

          <button
            onClick={() => onChangePaintMode("brush")}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border font-medium transition-colors ${
              paintMode === "brush"
                ? "bg-blue-950/80 border-blue-600 text-blue-200"
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Paintbrush className="w-3.5 h-3.5" />
            <span>Pincel de Caras</span>
          </button>
        </div>

        {paintMode === "flood" && (
          <div className="space-y-1 bg-zinc-900/40 p-2 rounded-lg border border-zinc-800/80">
            <div className="flex justify-between text-[11px] text-zinc-300">
              <span>Tolerancia Angular de Cara:</span>
              <span className="font-mono text-cyan-400">{floodAngleDeg}°</span>
            </div>
            <input
              type="range"
              min="5"
              max="65"
              step="5"
              value={floodAngleDeg}
              onChange={(e) => onChangeFloodAngle(Number(e.target.value))}
              className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
            <p className="text-[10px] text-zinc-500">
              Un clic selecciona todas las caras contiguas coplanares (ideal para letras o relieves).
            </p>
          </div>
        )}

        {/* Color Palette Picker */}
        <div className="space-y-2">
          <span className="text-zinc-300 text-[11px] font-medium">Paleta de Filamento:</span>
          <div className="grid grid-cols-5 gap-1.5">
            {DEFAULT_PALETTE.map((hex) => (
              <button
                key={hex}
                onClick={() => onChangeActiveColor(hex)}
                className={`h-7 rounded-md transition-all flex items-center justify-center border ${
                  activeColor === hex
                    ? "ring-2 ring-white border-transparent scale-105"
                    : "border-black/30 hover:scale-105"
                }`}
                style={{ backgroundColor: hex }}
                title={`Filamento: ${hex}`}
              >
                {activeColor === hex && <Check className="w-3.5 h-3.5 text-white drop-shadow" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Detected / Created Color Regions List */}
      {colorRegions.length > 0 && (
        <div className="border-t border-zinc-800 pt-3 space-y-2.5">
          <div className="flex items-center justify-between text-zinc-200 font-medium">
            <span>Grupos de Color Asignados ({colorRegions.length})</span>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
            {colorRegions.map((region) => {
              const percent = totalTriangles > 0
                ? ((region.triangleIndices.length / totalTriangles) * 100).toFixed(1)
                : 0;

              return (
                <div
                  key={region.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px]"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={region.color}
                      onChange={(e) => onUpdateRegionColor(region.id, e.target.value)}
                      className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0"
                      title="Cambiar color del grupo"
                    />
                    <div>
                      <div className="font-medium text-zinc-200">{region.name}</div>
                      <div className="text-[10px] text-zinc-400 font-mono">
                        {region.triangleIndices.length.toLocaleString()} tris ({percent}%)
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => onToggleRegionVisibility(region.id)}
                    className="p-1 text-zinc-400 hover:text-zinc-200 transition-colors"
                    title={region.visible ? "Ocultar grupo" : "Mostrar grupo"}
                  >
                    {region.visible ? (
                      <Eye className="w-3.5 h-3.5 text-cyan-400" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 text-zinc-600" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          <button
            onClick={onConvertToSubMeshes}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg font-medium transition-colors cursor-pointer border border-zinc-700"
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>Separar en Sub-Mallas para Slicer</span>
          </button>
        </div>
      )}
    </div>
  );
};
