import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export: the app is 100% client-side for now, so it ships as static assets on a Cloudflare Worker.
  output: "export",
  // cacheComponents / partialPrefetching are off: not supported with output: "export".
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
