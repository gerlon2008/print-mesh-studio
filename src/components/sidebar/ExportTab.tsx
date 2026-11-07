"use client";

import React, { useState } from "react";
import * as THREE from "three";
import { Download, FileArchive, Layers, CheckCircle2, Box } from "lucide-react";
import { SplitResultPart, ColorRegion, MeshStats } from "../../types";
import { exportGeometryAsSTL, exportPartsAsZip, exportAs3MF } from "../../utils/export3D";

interface ExportTabProps {
  modelName: string;
  mainGeometry: THREE.BufferGeometry | null;
  splitParts: SplitResultPart[] | null;
  colorRegions: ColorRegion[];
  stats: MeshStats | null;
}

export const ExportTab: React.FC<ExportTabProps> = ({
  modelName,
  mainGeometry,
  splitParts,
  colorRegions,
  stats,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const cleanBaseName = modelName.replace(/\.[^/.]+$/, "") || "modelo_impresion3d";

  // Determine exportable parts
  const getExportableParts = (): {
    name: string;
    color: string;
    geometry: THREE.BufferGeometry;
    stats?: MeshStats;
  }[] => {
    if (splitParts && splitParts.length > 0) {
      return splitParts.map((p) => ({
        name: p.name,
        color: p.color,
        geometry: p.geometry,
        stats: p.stats,
      }));
    }

    if (mainGeometry) {
      return [
        {
          name: cleanBaseName,
          color: "#06b6d4",
          geometry: mainGeometry,
          stats: stats || undefined,
        },
      ];
    }

    return [];
  };

  const handleExportSingleSTL = (partGeom: THREE.BufferGeometry, partName: string) => {
    setIsExporting(true);
    try {
      exportGeometryAsSTL(partGeom, `${cleanBaseName}_${partName}.stl`);
      setSuccessMsg(`STL "${partName}" exportado con éxito.`);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportZip = async () => {
    const parts = getExportableParts();
    if (parts.length === 0) return;

    setIsExporting(true);
    try {
      await exportPartsAsZip(parts, cleanBaseName);
      setSuccessMsg("Paquete ZIP con todas las piezas y guía AMS generado.");
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExport3MF = async () => {
    const parts = getExportableParts();
    if (parts.length === 0) return;

    setIsExporting(true);
    try {
      await exportAs3MF(parts, cleanBaseName);
      setSuccessMsg("Archivo 3MF multicolor listo para Bambu Studio / OrcaSlicer.");
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  const parts = getExportableParts();

  return (
    <div className="space-y-5 text-xs">
      <div>
        <div className="flex items-center gap-1.5 text-zinc-100 font-semibold text-sm">
          <Download className="w-4 h-4 text-emerald-400" />
          <span>Exportación para Slicers 3D</span>
        </div>
        <p className="text-zinc-400 text-[11px] mt-0.5">
          Descarga los modelos procesados listos para laminar en Bambu Studio, OrcaSlicer, PrusaSlicer o Cura.
        </p>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 bg-emerald-950/60 border border-emerald-800/80 p-2.5 rounded-lg text-emerald-300 text-[11px]">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Primary Export Actions */}
      <div className="space-y-2.5">
        <label className="text-zinc-300 font-medium">Formatos Unificados:</label>

        {/* 3MF Export Button */}
        <button
          onClick={handleExport3MF}
          disabled={isExporting || parts.length === 0}
          className="w-full flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-600 hover:to-teal-600 text-white font-medium shadow-md shadow-emerald-950/40 disabled:opacity-50 transition-all cursor-pointer text-left"
        >
          <div className="flex items-center gap-2.5">
            <Box className="w-5 h-5 text-emerald-200" />
            <div>
              <div className="font-semibold text-white">Exportar Proyecto .3MF Multicolor</div>
              <div className="text-[10px] text-emerald-200">
                Optimizado para Bambu Studio y OrcaSlicer (incluye ensamblaje)
              </div>
            </div>
          </div>
          <span className="text-[10px] bg-emerald-900/80 px-2 py-0.5 rounded text-emerald-200 uppercase font-mono">
            3MF
          </span>
        </button>

        {/* ZIP Package Export */}
        <button
          onClick={handleExportZip}
          disabled={isExporting || parts.length === 0}
          className="w-full flex items-center justify-between p-3 rounded-xl bg-zinc-900 border border-zinc-700 hover:bg-zinc-800/80 text-zinc-100 font-medium transition-all disabled:opacity-50 cursor-pointer text-left"
        >
          <div className="flex items-center gap-2.5">
            <FileArchive className="w-5 h-5 text-cyan-400" />
            <div>
              <div className="font-semibold text-zinc-200">Paquete Unificado .ZIP (STLs + AMS)</div>
              <div className="text-[10px] text-zinc-400">
                Archivos STL individuales + Manifiesto de filamento y guía de ensamble
              </div>
            </div>
          </div>
          <span className="text-[10px] bg-zinc-800 px-2 py-0.5 rounded text-zinc-400 uppercase font-mono">
            ZIP
          </span>
        </button>
      </div>

      {/* Individual Part STLs list */}
      {parts.length > 0 && (
        <div className="border-t border-zinc-800 pt-4 space-y-2.5">
          <div className="flex items-center justify-between text-zinc-300 font-medium">
            <span>Piezas Individuales ({parts.length})</span>
            <span className="text-[10px] text-zinc-500 font-mono">Descarga Directa STL</span>
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {parts.map((p, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/80 border border-zinc-800/80 text-[11px]"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0"
                    style={{ backgroundColor: p.color }}
                  />
                  <div>
                    <div className="text-zinc-200 font-medium">{p.name}</div>
                    <div className="text-[10px] text-zinc-500 font-mono">
                      {p.stats ? `${p.stats.triangleCount.toLocaleString()} tris` : "Malla procesada"}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleExportSingleSTL(p.geometry, p.name)}
                  disabled={isExporting}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-cyan-300 transition-colors"
                  title="Descargar STL individual"
                >
                  <Download className="w-3 h-3" />
                  <span>.STL</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
