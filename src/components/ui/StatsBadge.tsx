"use client";

import React from "react";
import { Box, Triangle, Scale, Maximize2 } from "lucide-react";
import { MeshStats } from "../../types";

interface StatsBadgeProps {
  stats: MeshStats | null;
  modelName: string;
}

export const StatsBadge: React.FC<StatsBadgeProps> = ({ stats, modelName }) => {
  if (!stats) return null;

  // Approximate PLA weight (density 1.24 g/cm3) with 20% infill estimate
  const plaWeightGrams = (stats.volumeCm3 * 1.24 * 0.35).toFixed(1);

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-2 bg-zinc-900/90 border-t border-zinc-800 text-[11px] font-mono text-zinc-400">
      <div className="flex items-center gap-1.5 text-zinc-200 font-sans font-medium pr-2 border-r border-zinc-800">
        <Box className="w-3.5 h-3.5 text-cyan-400" />
        <span className="truncate max-w-[140px]" title={modelName}>
          {modelName}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <Triangle className="w-3 h-3 text-zinc-500" />
        <span>Triángulos:</span>
        <span className="text-zinc-200 font-semibold">{stats.triangleCount.toLocaleString()}</span>
      </div>

      <div className="flex items-center gap-1.5">
        <span>Vértices:</span>
        <span className="text-zinc-200 font-semibold">{stats.vertexCount.toLocaleString()}</span>
      </div>

      <div className="flex items-center gap-1.5">
        <Maximize2 className="w-3 h-3 text-zinc-500" />
        <span>Dimensiones:</span>
        <span className="text-zinc-200">
          {stats.dimensions.x} × {stats.dimensions.y} × {stats.dimensions.z} mm
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <span>Volumen:</span>
        <span className="text-zinc-200">{stats.volumeCm3} cm³</span>
      </div>

      <div className="flex items-center gap-1.5">
        <Scale className="w-3 h-3 text-amber-500" />
        <span>Peso Estimado (PLA):</span>
        <span className="text-amber-400 font-semibold">~{plaWeightGrams} g</span>
      </div>
    </div>
  );
};
