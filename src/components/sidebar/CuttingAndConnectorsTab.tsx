"use client";

import React from "react";
import { Scissors, Cpu, Plus, Trash2, CheckCircle2, RotateCcw, AlertTriangle } from "lucide-react";
import { CutPlaneConfig, ConnectorPin, MeshStats } from "../../types";

interface CuttingAndConnectorsTabProps {
  stats: MeshStats | null;
  cutConfig: CutPlaneConfig;
  onChangeCutConfig: (config: CutPlaneConfig) => void;
  pins: ConnectorPin[];
  onUpdatePins: (pins: ConnectorPin[]) => void;
  onExecuteCut: () => void;
  onResetCut: () => void;
  isProcessingCSG: boolean;
  hasSplitParts: boolean;
}

export const CuttingAndConnectorsTab: React.FC<CuttingAndConnectorsTabProps> = ({
  stats,
  cutConfig,
  onChangeCutConfig,
  pins,
  onUpdatePins,
  onExecuteCut,
  onResetCut,
  isProcessingCSG,
  hasSplitParts,
}) => {
  // Determine bounds based on selected axis
  const maxOffset = stats
    ? Math.round(
        (cutConfig.axis === "x"
          ? stats.dimensions.x
          : cutConfig.axis === "y"
          ? stats.dimensions.y
          : stats.dimensions.z) / 2
      )
    : 30;

  const handleAddSymmetricalPins = () => {
    // Generate two balanced symmetrical pins
    const offsetDistance = Math.max(8, Math.min(maxOffset * 0.5, 20));
    const newPins: ConnectorPin[] = [
      {
        id: "pin-" + Date.now() + "-1",
        type: "cylinder",
        radius: 2.5, // 5mm diameter
        height: 8.0, // 8mm pin depth
        tolerance: 0.2, // 0.2mm standard 3D printing friction fit clearance
        position: [-offsetDistance, 0],
      },
      {
        id: "pin-" + Date.now() + "-2",
        type: "cylinder",
        radius: 2.5,
        height: 8.0,
        tolerance: 0.2,
        position: [offsetDistance, 0],
      },
    ];
    onUpdatePins([...pins, ...newPins]);
  };

  const handleClearPins = () => {
    onUpdatePins([]);
  };

  const handleRemovePin = (id: string) => {
    onUpdatePins(pins.filter((p) => p.id !== id));
  };

  const handleUpdatePinTolerance = (tolerance: number) => {
    onUpdatePins(pins.map((p) => ({ ...p, tolerance })));
  };

  const currentTolerance = pins.length > 0 ? pins[0].tolerance : 0.2;

  return (
    <div className="space-y-5 text-xs">
      <div>
        <div className="flex items-center gap-1.5 text-zinc-100 font-semibold text-sm">
          <Scissors className="w-4 h-4 text-red-400" />
          <span>Plano de Corte Interactivo</span>
        </div>
        <p className="text-zinc-400 text-[11px] mt-0.5">
          Secciona la malla en dos partes y añade pines cilíndricos con tolerancia para ensamblar.
        </p>
      </div>

      {/* Axis Selection */}
      <div className="space-y-1.5">
        <label className="text-zinc-300 font-medium">Eje de Corte:</label>
        <div className="grid grid-cols-3 gap-2">
          {(["z", "y", "x"] as const).map((axis) => (
            <button
              key={axis}
              onClick={() => onChangeCutConfig({ ...cutConfig, axis, enabled: true })}
              className={`py-1.5 rounded-lg border font-mono font-medium uppercase transition-colors ${
                cutConfig.axis === axis
                  ? "bg-red-950/80 border-red-700 text-red-200"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Eje {axis}
            </button>
          ))}
        </div>
      </div>

      {/* Position Offset Slider */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-zinc-300">
          <span>Posición del Corte:</span>
          <span className="font-mono text-cyan-400">{cutConfig.offset} mm</span>
        </div>
        <input
          type="range"
          min={-maxOffset}
          max={maxOffset}
          step="0.5"
          value={cutConfig.offset}
          onChange={(e) =>
            onChangeCutConfig({
              ...cutConfig,
              offset: Number(e.target.value),
              enabled: true,
            })
          }
          className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-red-500"
        />
        <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
          <span>-{maxOffset} mm</span>
          <span>Centro (0)</span>
          <span>+{maxOffset} mm</span>
        </div>
      </div>

      {/* Angle Rotation Slider */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-zinc-300">
          <span>Inclinación / Ángulo:</span>
          <span className="font-mono text-cyan-400">{cutConfig.angle}°</span>
        </div>
        <input
          type="range"
          min="-45"
          max="45"
          step="1"
          value={cutConfig.angle}
          onChange={(e) =>
            onChangeCutConfig({
              ...cutConfig,
              angle: Number(e.target.value),
              enabled: true,
            })
          }
          className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-red-500"
        />
      </div>

      {/* Connector Pins Section */}
      <div className="border-t border-zinc-800 pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-medium text-zinc-200">
            <Cpu className="w-3.5 h-3.5 text-amber-400" />
            <span>Pines de Conexión ({pins.length})</span>
          </div>
          {pins.length > 0 && (
            <button
              onClick={handleClearPins}
              className="text-[10px] text-zinc-500 hover:text-red-400 transition-colors"
            >
              Borrar todos
            </button>
          )}
        </div>

        {/* Pin Tolerance Slider */}
        <div className="bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800 space-y-1.5">
          <div className="flex justify-between text-[11px]">
            <span className="text-zinc-300">Tolerancia de Encaje (Clearance):</span>
            <span className="font-mono font-semibold text-amber-400">{currentTolerance} mm</span>
          </div>
          <input
            type="range"
            min="0.10"
            max="0.45"
            step="0.05"
            value={currentTolerance}
            onChange={(e) => handleUpdatePinTolerance(Number(e.target.value))}
            className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
          <div className="flex justify-between text-[9px] text-zinc-500 font-mono">
            <span>0.10mm (Muy ajustado)</span>
            <span className="text-amber-300">0.20mm (Recomendado FDM)</span>
            <span>0.45mm (Holgado)</span>
          </div>
        </div>

        {/* Quick Add Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleAddSymmetricalPins}
            className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-zinc-900 border border-zinc-700/80 hover:bg-zinc-800 text-zinc-200 rounded-lg font-medium transition-colors"
          >
            <Plus className="w-3 h-3 text-cyan-400" />
            <span>2 Pines Simétricos</span>
          </button>

          <button
            onClick={() => {
              const newPin: ConnectorPin = {
                id: "pin-" + Date.now(),
                type: "cylinder",
                radius: 2.5,
                height: 8.0,
                tolerance: currentTolerance,
                position: [0, 0],
              };
              onUpdatePins([...pins, newPin]);
            }}
            className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-zinc-900 border border-zinc-700/80 hover:bg-zinc-800 text-zinc-200 rounded-lg font-medium transition-colors"
          >
            <Plus className="w-3 h-3 text-amber-400" />
            <span>1 Pin al Centro</span>
          </button>
        </div>

        {/* Pin List Display */}
        {pins.length > 0 && (
          <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
            {pins.map((pin, i) => (
              <div
                key={pin.id}
                className="flex items-center justify-between p-2 rounded bg-zinc-900/80 border border-zinc-800/80 text-[11px]"
              >
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-cyan-950 border border-cyan-700 text-cyan-300 flex items-center justify-center text-[10px] font-mono">
                    {i + 1}
                  </span>
                  <div>
                    <div className="text-zinc-200 font-medium">
                      Ø {pin.radius * 2}mm × {pin.height}mm
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono">
                      Pos: [{pin.position[0]}, {pin.position[1]}] mm
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleRemovePin(pin.id)}
                  className="text-zinc-500 hover:text-red-400 p-1 transition-colors"
                  title="Eliminar pin"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="border-t border-zinc-800 pt-4 space-y-2">
        <button
          onClick={onExecuteCut}
          disabled={isProcessingCSG || !stats}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-medium shadow-md shadow-red-950/40 disabled:opacity-50 transition-all cursor-pointer"
        >
          {isProcessingCSG ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Calculando Operaciones Booleanas CSG...</span>
            </>
          ) : (
            <>
              <Scissors className="w-4 h-4" />
              <span>Ejecutar Corte CSG y Ensamblaje</span>
            </>
          )}
        </button>

        {hasSplitParts && (
          <button
            onClick={onResetCut}
            disabled={isProcessingCSG}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restablecer Pieza Completa</span>
          </button>
        )}
      </div>

      <div className="bg-zinc-900/40 border border-zinc-800/60 p-2.5 rounded-lg text-[10px] text-zinc-500 flex items-start gap-1.5">
        <AlertTriangle className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
        <span>
          El generador CSG crea automáticamente el pin macho en la Parte A y extrae la cavidad con
          holgura de tolerancia en la Parte B para un encaje por fricción perfecto en tu impresora 3D.
        </span>
      </div>
    </div>
  );
};
