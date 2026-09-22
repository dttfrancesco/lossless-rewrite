import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: process.cwd() },
  serverExternalPackages: ["pdfjs-dist"],
  outputFileTracingIncludes: { "/api/import": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs", "./node_modules/pdfjs-dist/standard_fonts/**/*"] },
  devIndicators: false,
};

export default nextConfig;
