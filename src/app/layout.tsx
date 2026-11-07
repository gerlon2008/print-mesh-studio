import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PrintMesh Studio - 3D Print Multi-Color & CSG Splitting",
  description: "Modern 3D Printing SPA: File Viewer, Color Segmentation, CSG Cut & Connector Generator, 3MF/STL Export",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body className="antialiased bg-zinc-950 text-zinc-100 h-screen w-screen overflow-hidden">
        {children}
      </body>
    </html>
  );
}
