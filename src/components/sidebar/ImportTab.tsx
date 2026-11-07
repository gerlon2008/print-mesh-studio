"use client";

import React, { useRef, useState } from "react";
import * as THREE from "three";
import { Upload, Box, Sparkles, AlertCircle, RefreshCw, FileText } from "lucide-react";
import { import3DModelFile } from "../../utils/fileImporter";
import { TripoDetectedPart } from "../../utils/tripoSegmentation";
import {
  createMechanicalTestPiece,
  createLowPolyCharacter,
  createPrecisionGear,
} from "../../utils/sampleModels";

interface ImportTabProps {
  onLoadModel: (
    geom: THREE.BufferGeometry,
    fileName: string,
    preSeparatedParts?: TripoDetectedPart[]
  ) => void;
  isLoading: boolean;
  setIsLoading: (val: boolean) => void;
}

export const ImportTab: React.FC<ImportTabProps> = ({
  onLoadModel,
  isLoading,
  setIsLoading,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleProcessFile = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "stl" && ext !== "3mf" && ext !== "obj") {
      setErrorMsg("Formato no soportado. Por favor sube un archivo .stl, .3mf o .obj");
      return;
    }

    setErrorMsg(null);
    setIsLoading(true);

    try {
      const result = await import3DModelFile(file);
      onLoadModel(result.combinedGeometry, result.fileName, result.preSeparatedParts);
    } catch (err: any) {
      console.error("Error importando archivo:", err);
      setErrorMsg(err.message || "Error al procesar el archivo 3D.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleSampleLoad = (type: "mechanical" | "bunny" | "gear") => {
    setIsLoading(true);
    setErrorMsg(null);
    setTimeout(() => {
      let geom: THREE.BufferGeometry;
      let name = "";
      if (type === "mechanical") {
        geom = createMechanicalTestPiece();
        name = "Pieza_Mecanica_Calibracion.stl";
      } else if (type === "bunny") {
        geom = createLowPolyCharacter();
        name = "Mascota_Articulada_LowPoly.stl";
      } else {
        geom = createPrecisionGear();
        name = "Engranaje_Precision_3D.stl";
      }
      onLoadModel(geom, name);
      setIsLoading(false);
    }, 50);
  };

  return (
    <div className="space-y-4 text-xs">
      <div>
        <h3 className="font-semibold text-zinc-100 text-sm mb-1">Cargar Modelo 3D</h3>
        <p className="text-zinc-400 text-[11px]">
          Arrastra o selecciona un archivo para visualización, segmentación semántica Tripo AI o corte.
        </p>
      </div>

      {/* Format Support Badges */}
      <div className="flex items-center gap-1.5 text-[10px] font-mono">
        <span className="px-2 py-0.5 rounded bg-zinc-800 text-cyan-300 border border-zinc-700">
          .STL (Binario/ASCII)
        </span>
        <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800">
          .3MF (Bambu/Orca)
        </span>
        <span className="px-2 py-0.5 rounded bg-zinc-800 text-purple-300 border border-zinc-700">
          .OBJ
        </span>
      </div>

      {/* Drag & Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2.5 ${
          dragOver
            ? "border-cyan-400 bg-cyan-950/30 scale-[1.01]"
            : "border-zinc-700/80 hover:border-zinc-500 bg-zinc-900/40"
        }`}
      >
        <div className="p-3 bg-zinc-800 rounded-full text-cyan-400 shadow-inner">
          <Upload className="w-5 h-5" />
        </div>
        <div>
          <span className="font-medium text-zinc-200 text-xs">
            {isLoading ? "Cargando y procesando geometría..." : "Haz clic o arrastra tu archivo aquí"}
          </span>
          <p className="text-[11px] text-zinc-500 mt-0.5">Compatible con STL, 3MF y OBJ</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".stl,.3mf,.obj"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleProcessFile(e.target.files[0]);
            }
          }}
        />
      </div>

      {errorMsg && (
        <div className="flex items-start gap-2 bg-red-950/40 border border-red-800/80 p-2.5 rounded-lg text-red-300 text-[11px]">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Presets */}
      <div className="border-t border-zinc-800 pt-3">
        <div className="flex items-center gap-1.5 mb-2 text-zinc-300 font-medium text-xs">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Modelos de Muestra Rápidos</span>
        </div>

        <div className="grid grid-cols-1 gap-2">
          <button
            onClick={() => handleSampleLoad("bunny")}
            disabled={isLoading}
            className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-cyan-500 hover:bg-zinc-800/60 text-left transition-colors"
          >
            <div>
              <div className="font-medium text-zinc-200">Mascota Orgánica Multi-Zona</div>
              <div className="text-[10px] text-zinc-400">Recomendada para Detección de Partes Tripo AI</div>
            </div>
            <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
          </button>

          <button
            onClick={() => handleSampleLoad("mechanical")}
            disabled={isLoading}
            className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-cyan-500 hover:bg-zinc-800/60 text-left transition-colors"
          >
            <div>
              <div className="font-medium text-zinc-200">Caja de Ensamble y Calibración</div>
              <div className="text-[10px] text-zinc-400">Excelente para corte y pasadores dowels</div>
            </div>
            <Box className="w-4 h-4 text-cyan-400 shrink-0" />
          </button>

          <button
            onClick={() => handleSampleLoad("gear")}
            disabled={isLoading}
            className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-cyan-500 hover:bg-zinc-800/60 text-left transition-colors"
          >
            <div>
              <div className="font-medium text-zinc-200">Engranaje con Núcleo Bicolor</div>
              <div className="text-[10px] text-zinc-400">Ideal para exportación multicolor a Bambu Studio</div>
            </div>
            <RefreshCw className="w-4 h-4 text-emerald-400 shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
};
