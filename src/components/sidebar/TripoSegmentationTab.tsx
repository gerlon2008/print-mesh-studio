"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Layers,
  Sliders,
  Eye,
  EyeOff,
  Box,
  CheckCircle2,
  Trash2,
  Cpu,
  Download,
  Flame,
} from "lucide-react";
import { TripoDetectedPart, SegmentationTier } from "../../utils/tripoSegmentation";

interface TripoSegmentationTabProps {
  detectedParts: TripoDetectedPart[];
  selectedPartId: string | null;
  onSelectPart: (id: string | null) => void;
  explodedDistance: number;
  onChangeExplodedDistance: (dist: number) => void;
  onRunTripoSegmentation: (tier: SegmentationTier) => void;
  onUpdatePartColor: (partId: string, newColor: string) => void;
  onTogglePartVisibility: (partId: string) => void;
  onGenerateConnectorsBetweenParts: () => void;
  onResetSegmentation: () => void;
  isProcessing: boolean;
  totalTriangles: number;
}

export const TripoSegmentationTab: React.FC<TripoSegmentationTabProps> = ({
  detectedParts,
  selectedPartId,
  onSelectPart,
  explodedDistance,
  onChangeExplodedDistance,
  onRunTripoSegmentation,
  onUpdatePartColor,
  onTogglePartVisibility,
  onGenerateConnectorsBetweenParts,
  onResetSegmentation,
  isProcessing,
  totalTriangles,
}) => {
  const [selectedTier, setSelectedTier] = useState<SegmentationTier>("balanced");
  const [isGeneratingConnectors, setIsGeneratingConnectors] = useState(false);

  const handleRun = () => {
    onRunTripoSegmentation(selectedTier);
  };

  const handleConnectors = () => {
    setIsGeneratingConnectors(true);
    setTimeout(() => {
      onGenerateConnectorsBetweenParts();
      setIsGeneratingConnectors(false);
    }, 100);
  };

  return (
    <div className="space-y-4 text-xs">
      <div>
        <div className="flex items-center gap-1.5 text-zinc-100 font-semibold text-sm">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span>Detección de Partes (Estilo Tripo AI)</span>
        </div>
        <p className="text-zinc-400 text-[11px] mt-0.5">
          Segmenta la geometría completa en componentes funcionales según curvaturas, estrangulamientos
          y puntos de unión anatómicos/mecánicos.
        </p>
      </div>

      {/* Tier Selector (Simple / Balanced / Detailed) */}
      <div className="bg-zinc-900/70 p-3 rounded-xl border border-zinc-800 space-y-2.5">
        <label className="text-zinc-200 font-medium text-[11px]">
          Nivel de Profundidad del Despiece:
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { id: "simple", label: "Simple", desc: "3-5 partes" },
            { id: "balanced", label: "Equilibrado", desc: "6-9 partes" },
            { id: "detailed", label: "Detallado", desc: "10-14 partes" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTier(t.id as SegmentationTier)}
              className={`p-2 rounded-lg border text-center transition-all ${
                selectedTier === t.id
                  ? "bg-cyan-950/80 border-cyan-500 text-cyan-200 shadow-sm"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <div className="font-semibold text-[11px]">{t.label}</div>
              <div className="text-[9px] text-zinc-500 mt-0.5">{t.desc}</div>
            </button>
          ))}
        </div>

        <button
          onClick={handleRun}
          disabled={isProcessing}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold shadow-md shadow-cyan-950/40 disabled:opacity-50 transition-all cursor-pointer"
        >
          {isProcessing ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Analizando Geometría y Estrangulamientos...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Segmentar Modelo en Partes (Tripo AI)</span>
            </>
          )}
        </button>
      </div>

      {/* Exploded View Slider (Active once parts are detected) */}
      {detectedParts.length > 0 && (
        <div className="bg-cyan-950/30 p-3 rounded-xl border border-cyan-800/60 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-medium text-cyan-300">
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              <span>Despiece 3D (Exploded View):</span>
            </div>
            <span className="font-mono text-cyan-400 font-bold">{explodedDistance} mm</span>
          </div>

          <input
            type="range"
            min="0"
            max="60"
            step="1"
            value={explodedDistance}
            onChange={(e) => onChangeExplodedDistance(Number(e.target.value))}
            className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />

          <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
            <span>0 mm (Ensamble)</span>
            <span>30 mm (Vista media)</span>
            <span>60 mm (Despiece total)</span>
          </div>
        </div>
      )}

      {/* Detected Parts List & Outliner Tree */}
      {detectedParts.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-zinc-200 font-medium">
            <span>Componentes Detectados ({detectedParts.length})</span>
            <button
              onClick={onResetSegmentation}
              className="text-[10px] text-zinc-500 hover:text-red-400 transition-colors"
            >
              Restablecer modelo
            </button>
          </div>

          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {detectedParts.map((part) => {
              const isSelected = part.id === selectedPartId;
              const percent = totalTriangles > 0
                ? ((part.stats.triangleCount / totalTriangles) * 100).toFixed(1)
                : 0;

              return (
                <div
                  key={part.id}
                  onClick={() => onSelectPart(part.id)}
                  className={`flex items-center justify-between p-2 rounded-lg border transition-all cursor-pointer text-[11px] ${
                    isSelected
                      ? "bg-cyan-950/60 border-cyan-500 shadow-sm"
                      : "bg-zinc-900 border-zinc-800 hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={part.color}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => onUpdatePartColor(part.id, e.target.value)}
                      className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0 shrink-0"
                      title="Cambiar color del filamento"
                    />
                    <div className="truncate max-w-[170px]">
                      <div className="font-medium text-zinc-100 truncate">{part.name}</div>
                      <div className="text-[10px] text-zinc-500 font-mono">
                        {part.stats.triangleCount.toLocaleString()} tris ({percent}%) | {part.stats.volumeCm3} cm³
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePartVisibility(part.id);
                    }}
                    className="p-1 text-zinc-400 hover:text-zinc-200 transition-colors shrink-0"
                  >
                    {part.visible ? (
                      <Eye className="w-3.5 h-3.5 text-cyan-400" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 text-zinc-600" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Action: Generate alignment connectors / Dowels between detected parts */}
          <button
            onClick={handleConnectors}
            disabled={isGeneratingConnectors}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-zinc-900 border border-zinc-700 hover:border-cyan-500 hover:bg-zinc-800 text-zinc-100 font-medium transition-colors cursor-pointer"
          >
            {isGeneratingConnectors ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Generando orificios y pasadores...</span>
              </>
            ) : (
              <>
                <Cpu className="w-3.5 h-3.5 text-amber-400" />
                <span>Generar Conectores / Pasadores de Ensamble</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
