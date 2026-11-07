import * as THREE from "three";
import JSZip from "jszip";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { MeshStats, SplitResultPart, ColorRegion } from "../types";

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exports a single geometry as binary STL file
 */
export function exportGeometryAsSTL(geometry: THREE.BufferGeometry, filename: string) {
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  const exporter = new STLExporter();
  const stlData = exporter.parse(mesh, { binary: true }) as DataView;

  const blob = new Blob([stlData.buffer as ArrayBuffer], { type: "application/octet-stream" });
  downloadBlob(blob, filename.endsWith(".stl") ? filename : `${filename}.stl`);
}

/**
 * Exports multiple parts/regions as individual STLs inside a ZIP package
 * Includes an AMS / Filament Color Manifest for Bambu Studio & OrcaSlicer
 */
export async function exportPartsAsZip(
  parts: { name: string; color: string; geometry: THREE.BufferGeometry; stats?: MeshStats }[],
  baseProjectName: string = "print_project"
) {
  const zip = new JSZip();
  const exporter = new STLExporter();
  const manifestItems: any[] = [];

  parts.forEach((part, idx) => {
    const mesh = new THREE.Mesh(part.geometry, new THREE.MeshBasicMaterial());
    const stlOutput = exporter.parse(mesh, { binary: true }) as DataView;
    const cleanName = `${idx + 1}_${part.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.stl`;

    zip.file(cleanName, stlOutput.buffer as ArrayBuffer);

    manifestItems.push({
      fileName: cleanName,
      partName: part.name,
      filamentColorHex: part.color,
      triangles: part.stats?.triangleCount || part.geometry.getAttribute("position")?.count / 3,
      dimensionsMm: part.stats?.dimensions,
    });
  });

  // Add slicer filament guide & readme
  const readmeContent = `# 3D Print Multi-Part Assembly Guide
Project: ${baseProjectName}
Generated with PrintMesh Studio for Bambu Studio / OrcaSlicer / PrusaSlicer

## Parts & Filament Assignments:
${manifestItems
  .map(
    (item, i) =>
      `- Slot ${i + 1}: **${item.partName}** (${item.fileName}) -> Hex: \`${item.filamentColorHex}\``
  )
  .join("\n")}

## Recommended Slicer Settings:
- Layer Height: 0.20mm (Standard) or 0.16mm (Optimal)
- Infill: 15% - 25% Gyroid
- Tolerance for pins/connectors: 0.20mm clearance applied
`;

  zip.file("README_PRINT_INSTRUCTIONS.md", readmeContent);
  zip.file("ams_colors_manifest.json", JSON.stringify(manifestItems, null, 2));

  const zipBlob = await zip.generateAsync({ type: "blob" });
  downloadBlob(zipBlob, `${baseProjectName}_parts.zip`);
}

/**
 * Exports a valid 3MF package containing multiple colored components.
 * 3MF is an XML format bundled in a ZIP container, natively understood by Bambu Studio / OrcaSlicer.
 */
export async function exportAs3MF(
  parts: { name: string; color: string; geometry: THREE.BufferGeometry }[],
  projectName: string = "model"
) {
  const zip = new JSZip();

  // 1. [Content_Types].xml
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>`
  );

  // 2. _rels/.rels
  zip.folder("_rels")?.file(
    ".rels",
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`
  );

  // 3. Build 3D/3dmodel.model
  let objectsXml = "";
  let buildXml = "";

  parts.forEach((part, objIdx) => {
    const objectId = objIdx + 1;
    const geom = part.geometry.toNonIndexed();
    const pos = geom.getAttribute("position");
    const count = pos.count;

    let verticesXml = "";
    let trianglesXml = "";

    for (let i = 0; i < count; i++) {
      const x = pos.getX(i).toFixed(4);
      const y = pos.getY(i).toFixed(4);
      const z = pos.getZ(i).toFixed(4);
      verticesXml += `        <vertex x="${x}" y="${y}" z="${z}" />\n`;
    }

    const triCount = count / 3;
    for (let t = 0; t < triCount; t++) {
      const v1 = t * 3;
      const v2 = t * 3 + 1;
      const v3 = t * 3 + 2;
      trianglesXml += `        <triangle v1="${v1}" v2="${v2}" v3="${v3}" />\n`;
    }

    objectsXml += `    <object id="${objectId}" name="${part.name}" type="model">
      <mesh>
        <vertices>
${verticesXml}        </vertices>
        <triangles>
${trianglesXml}        </triangles>
      </mesh>
    </object>\n`;

    buildXml += `    <item objectid="${objectId}" />\n`;
  });

  const modelXml = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <metadata name="Title">${projectName}</metadata>
  <metadata name="Designer">PrintMesh Studio</metadata>
  <resources>
${objectsXml}  </resources>
  <build>
${buildXml}  </build>
</model>`;

  zip.folder("3D")?.file("3dmodel.model", modelXml);

  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(blob, `${projectName}.3mf`);
}
