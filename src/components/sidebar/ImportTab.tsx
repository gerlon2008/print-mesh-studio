"use client";

import React, { useRef, useState } from "react";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { Upload, Box, Sparkles, AlertCircle, RefreshCw } from "lucide-react";
import {
  createMechanicalTestPiece,
  createLowPolyCharacter,
  createPrecisionGear,
} from "../../utils/sampleModels";

interface ImportTabProps {
  onLoadGeometry: (geom: THREE.BufferGeometry, fileName: string) => void;
  isLoading: boolean;
  setIsLoading: (val: boolean) => void;
}

export const ImportTab: React.FC<ImportTabProps> = ({
  onLoadGeometry,
  isLoading,
  setIsLoading,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const processSTLFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith(".stl")) {
      setErrorMsg("Formato no soportado. Por favor arrastra un archivo .stl");
      return;
    }
    setErrorMsg(null);
    setIsLoading(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const loader = new STLLoader();
        const geometry = loader.parse(buffer);

        // Center on build plate origin and align base to z=0
        geometry.computeBoundingBox();
        const bbox = geometry.boundingBox || new THREE.Box3();
        const center = new THREE.Vector3();
        bbox.getCenter(center);
        geometry.translate(-center.x, -center.y, -bbox.min.z);
        geometry.computeVertexNormals();
        geometry.computeBoundingBox();

        onLoadGeometry(geometry, file.name);
      } catch (err: any) {
        console.error("Error parsing STL:", err);
        setErrorMsg("Error al procesar el archivo STL: " + (err.message || "Archivo corrupto"));
      } finally {
        setIsLoading(false);
      }
    };

    reader.onerror = () => {
      setErrorMsg("Error al leer el archivo del disco");
      setIsLoading(false);
    };

    reader.readAsArrayBuffer(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processSTLFile(e.dataTransfer.files[0]);
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
        name = "Pieza_Mecanica_Test.stl";
      } else if (type === "bunny") {
        geom = createLowPolyCharacter();
        name = "Mascota_LowPoly_Organico.stl";
      } else {
        geom = createPrecisionGear();
        name = "Engranaje_Precision_3D.stl";
      }
      onLoadGeometry(geom, name);
      setIsLoading(false);
    }, 50);
  };

  return (
    <div className="space-y-5 text-xs">
      <div>
        <h3 className="font-semibold text-zinc-100 text-sm mb-1">Cargar Modelo 3D</h3>
        <p className="text-zinc-400 text-[11px]">
          Arrastra o selecciona un archivo STL para comenzar el análisis, corte o segmentación.
        </p>
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
            ? "border-cyan-400 bg-cyan-950/20"
            : "border-zinc-700/80 hover:border-zinc-500 bg-zinc-900/40"
        }`}
      >
        <div className="p-3 bg-zinc-800 rounded-full text-cyan-400">
          <Upload className="w-5 h-5" />
        </div>
        <div>
          <span className="font-medium text-zinc-200">
            {isLoading ? "Cargando geometría..." : "Haz clic o arrastra tu archivo STL"}
          </span>
          <p className="text-[11px] text-zinc-500 mt-0.5">Soporta STL binario y ASCII</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".stl"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              processSTLFile(e.target.files[0]);
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

      {/* Preset Sample Models */}
      <div className="border-t border-zinc-800 pt-4">
        <div className="flex items-center gap-1.5 mb-2.5 text-zinc-300 font-medium">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Modelos de Muestra Rápidos</span>
        </div>
        <p className="text-zinc-500 text-[11px] mb-3">
          ¿No tienes un STL a mano? Prueba las herramientas con modelos diseñados para pruebas:
        </p>

        <div className="grid grid-cols-1 gap-2">
          <button
            onClick={() => handleSampleLoad("mechanical")}
            disabled={isLoading}
            className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/60 text-left transition-colors"
          >
            <div>
              <div className="font-medium text-zinc-200">Pieza de Prueba Mecánica</div>
              <div className="text-[10px] text-zinc-400">Ideal para corte CSG y pines machos/hembras</div>
            </div>
            <Box className="w-4 h-4 text-cyan-400 shrink-0" />
          </button>

          <button
            onClick={() => handleSampleLoad("bunny")}
            disabled={isLoading}
            className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/60 text-left transition-colors"
          >
            <div>
              <div className="font-medium text-zinc-200">Mascota Low-Poly Orgánica</div>
              <div className="text-[10px] text-zinc-400">Ideal para segmentación de color por IA (K-Means)</div>
            </div>
            <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
          </button>

          <button
            onClick={() => handleSampleLoad("gear")}
            disabled={isLoading}
            className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/60 text-left transition-colors"
          >
            <div>
              <div className="font-medium text-zinc-200">Engranaje con Núcleo</div>
              <div className="text-[10px] text-zinc-400">Ideal para ensamble multicolor en slicer</div>
            </div>
            <RefreshCw className="w-4 h-4 text-emerald-400 shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
};
