# 🖨️ PrintMesh Studio 3D

Una aplicación web moderna (SPA) para preparación, corte y segmentación cromática de modelos para **impresión 3D** (FDM / SLA), construida con **React**, **Next.js**, **TypeScript**, **Tailwind CSS** y **Three.js** con motor booleano **three-bvh-csg**.

Diseñada para integrarse a la perfección con slicers modernos como **Bambu Studio**, **OrcaSlicer**, **PrusaSlicer** y **Cura**.

---

## 🚀 Características Principales

### 1. Visor e Importador 3D Fluido
- **Carga de Archivos**: Drag & Drop o selector de archivos `.stl` (binario y ASCII).
- **Entorno Slicer**: Cama de impresión realista (250 × 250 mm) orientada con Z-Up y marcas milimétricas.
- **Controles de Órbita y Vistas**: Rotación, zoom, paneo, y botones rápidos para vistas ortográficas (ISO, TOP, FRONT, SIDE).
- **Estadísticas en Tiempo Real**:
  - Conteo de triángulos y vértices.
  - Dimensiones exactas del Bounding Box ($X \times Y \times Z$ en mm).
  - Cálculo de volumen ($cm^3$) por tetraedros y área superficial ($cm^2$).
  - Estimación de peso de filamento PLA (con densidad $1.24\text{ g/cm}^3$).

### 2. Plano de Corte Interactivo y Conectores Macho/Hembra (CSG)
- **Plano de Corte en Tiempo Real**:
  - Selección de eje de seccionamiento ($X$, $Y$, $Z$).
  - Slider de desplazamiento milimétrico e inclinación angular (-45° a +45°).
  - Visualización del plano semi-transparente en la escena 3D.
- **Generador Automático de Pines y Cajas**:
  - Generación rápida de pines simétricos o ubicación interactiva haciendo clic directamente sobre el plano de corte.
  - Parámetros ajustables de diámetro, longitud y **tolerancia de encaje** (clearance con recomendación de 0.20 mm para FDM).
  - Operaciones booleanas (`three-bvh-csg`):
    - **Parte A (Superior)**: Unión booleana (`ADDITION`) con pin macho.
    - **Parte B (Inferior)**: Sustracción booleana (`SUBTRACTION`) de cavidad hembra con tolerancia para encaje por fricción.
- **Vista Despiezada (Exploded View)**:
  - Slider interactivo para separar ambas partes en tiempo real y verificar los pines y cavidades internas.

### 3. Segmentación de Color Asistida por Algoritmos e IA
- **Clustering K-Means**:
  - Segmentación automática en $K$ clusters (2 a 6 colores) analizando vectores normales y posiciones espaciales de cada triángulo.
  - Ponderación ajustable: sesgo geométrico (orientación de paredes/techos) vs sesgo de altura/posición.
- **Pintura y Selección Manual**:
  - **Relleno Inteligente (Flood Fill)**: Selección contigua de caras coplanares con tolerancia angular configurable (ideal para letras, números o relieves).
  - **Pincel de Caras**: Asignación rápida de color por raycasting.
  - Paleta de filamentos predefinidos y selector personalizado HEX.
- **Conversión a Sub-Mallas**:
  - Divide la geometría completa en piezas independientes listas para exportación multicolor.

### 4. Exportación Profesional para Slicers
- **Descarga Directa STL**: Archivos binarios individuales limpios por cada pieza o color.
- **Paquete Unificado ZIP**:
  - Todos los STLs rotulados.
  - `README_PRINT_INSTRUCTIONS.md` con recomendaciones de altura de capa y relleno.
  - `ams_colors_manifest.json` con mapa de colores para las ranuras del Bambu Lab AMS u OrcaSlicer.
- **Proyecto .3MF Multicolor**:
  - Formato estándar XML dentro de contenedor ZIP compatible nativamente con Bambu Studio, OrcaSlicer y PrusaSlicer, manteniendo las piezas pre-ensambladas en sus posiciones relativas.

---

## 🛠️ Estructura del Código

```text
print-mesh-studio/
├── src/
│   ├── app/
│   │   ├── globals.css              # Estilos base y variables de tema oscuro
│   │   ├── layout.tsx               # Root layout Next.js
│   │   └── page.tsx                 # Contenedor principal de la SPA
│   ├── components/
│   │   ├── sidebar/
│   │   │   ├── Sidebar.tsx          # Panel lateral con tabs organizadas
│   │   │   ├── ImportTab.tsx        # Drag & drop y modelos de prueba
│   │   │   ├── CuttingAndConnectorsTab.tsx # Control de corte y pines CSG
│   │   │   ├── ColorSegmentationTab.tsx    # K-Means y pintura de caras
│   │   │   └── ExportTab.tsx        # Exportador STL, ZIP y 3MF
│   │   ├── ui/
│   │   │   ├── StatsBadge.tsx       # Barra de estadísticas de malla
│   │   │   └── Toolbar.tsx          # Herramientas superiores y vista despiezada
│   │   └── viewer/
│   │       ├── BuildPlate.ts        # Geometría y retícula de la cama de impresión
│   │       └── ThreeViewer.tsx      # Escena Three.js, luces, cámara y raycaster
│   ├── types/
│   │   └── index.ts                 # Definiciones TypeScript
│   └── utils/
│       ├── colorClustering.ts       # Algoritmo K-Means y flood fill de caras
│       ├── connectorGenerator.ts    # Modelado de cilindros macho/hembra
│       ├── csgCutting.ts            # Motor booleano CSG (three-bvh-csg)
│       ├── export3D.ts              # Generador de STL binario, ZIP y 3MF
│       ├── meshStats.ts             # Cálculo de dimensiones, volumen y área
│       └── sampleModels.ts          # Modelos procedurales (Cubo test, Mascota, Engranaje)
├── package.json
└── tsconfig.json
```

---

## 🚀 Despliegue en Vercel

La aplicación está completamente optimizada para ser desplegada en Vercel con cero configuración adicional:

1. Sube el código a tu repositorio de GitHub:
   ```bash
   git init
   git add .
   git commit -m "feat: initial commit PrintMesh Studio 3D"
   git remote add origin https://github.com/TU_USUARIO/print-mesh-studio.git
   git push -u origin main
   ```
2. Entra en [vercel.com](https://vercel.com) y haz clic en **Add New Project**.
3. Selecciona tu repositorio `print-mesh-studio`.
4. Deja la configuración predeterminada (Framework Preset: **Next.js**) y haz clic en **Deploy**.
5. ¡Listo! Tu aplicación estará en vivo con URL personalizada y HTTPS.
