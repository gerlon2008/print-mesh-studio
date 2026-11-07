"use client";

import React from "react";
import {
  MousePointer,
  Scissors,
  Palette,
  Cpu,
  Layers,
  Eye,
  Sliders,
  Sparkles,
} from "lucide-react";
import { ActiveTool } from "../../types";

interface ToolbarProps {
  activeTool: ActiveTool;
  onSelectTool: (tool: ActiveTool) => void;
  wireframe: boolean;
  onToggleWireframe: () => void;
  hasSplitParts: boolean;
  explodedDistance: number;
  onChangeExplodedDistance: (dist: number) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  activeTool,
  onSelectTool,
  wireframe,
  onToggleWireframe,
  hasSplitParts,
  explodedDistance,
  onChangeExplodedDistance,
}) => {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800 text-xs">
      {/* Tool switcher buttons */}
      <div className="flex items-center gap-1.5 bg-zinc-950/70 p-1 rounded-lg border border-zinc-800">
        <button
          onClick={() => onSelectTool("view")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
            activeTool === "view"
              ? "bg-zinc-800 text-zinc-100 shadow"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
          }`}
          title="Modo Navegación y Órbita"
        >
          <MousePointer className="w-3.5 h-3.5" />
          <span>Navegar</span>
        </button>

        <button
          onClick={() => onSelectTool("cut")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
            activeTool === "cut"
              ? "bg-red-950/80 text-red-300 border border-red-800/80 shadow"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
          }`}
          title="Plano de Corte"
        >
          <Scissors className="w-3.5 h-3.5" />
          <span>Plano de Corte</span>
        </button>

        <button
          onClick={() => onSelectTool("connectors")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
            activeTool === "connectors"
              ? "bg-amber-950/80 text-amber-300 border border-amber-800/80 shadow"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
          }`}
          title="Generador de Pines y Cajas"
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>Conectores Macho/Hembra</span>
        </button>

        <button
          onClick={() => onSelectTool("paint")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
            activeTool === "paint"
              ? "bg-blue-950/80 text-blue-300 border border-blue-800/80 shadow"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
          }`}
          title="Separación por Color y Pintura"
        >
          <Palette className="w-3.5 h-3.5" />
          <span>Color & Regiones</span>
        </button>
      </div>

      {/* Exploded View Slider (if parts are split) & Wireframe Toggle */}
      <div className="flex items-center gap-4">
        {hasSplitParts && (
          <div className="flex items-center gap-2 bg-zinc-950/60 px-3 py-1 rounded-lg border border-zinc-800">
            <Sliders className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-[11px] text-zinc-400">Vista Despiezada:</span>
            <input
              type="range"
              min="0"
              max="60"
              step="1"
              value={explodedDistance}
              onChange={(e) => onChangeExplodedDistance(Number(e.target.value))}
              className="w-24 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
            <span className="font-mono text-[11px] text-cyan-400 w-10 text-right">
              {explodedDistance}mm
            </span>
          </div>
        )}

        <button
          onClick={onToggleWireframe}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-colors ${
            wireframe
              ? "bg-cyan-950/70 border-cyan-700 text-cyan-300"
              : "bg-zinc-800/50 border-zinc-700/60 text-zinc-300 hover:bg-zinc-800"
          }`}
          title="Alternar Malla de Alambre (Wireframe)"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Wireframe</span>
        </button>
      </div>
    </div>
  );
};
