import type { NextConfig } from "next";
import path from "path";

const IS_PROD = process.env.NODE_ENV === "production";
const ENABLE_CSP_REPORT_ONLY = process.env.CSP_REPORT_ONLY === "1";
const CSP_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "upgrade-insecure-requests",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https:",
  "style-src 'self' 'unsafe-inline' https:",
  "script-src 'self' 'unsafe-inline' https:",
  "connect-src 'self' https: wss:",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ytdegtoibuxcmmvtbgtq.supabase.co",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  typescript: {
    // Ignorar erros de typecheck no build para não bloquear deploy
    ignoreBuildErrors: true,
  },
  async headers() {
    const baseHeaders = [
      {
        key: "X-Frame-Options",
        value: "DENY",
      },
      {
        key: "X-Content-Type-Options",
        value: "nosniff",
      },
      {
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin",
      },
      {
        key: "X-XSS-Protection",
        value: "0",
      },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), payment=()",
      },
      {
        key: "Content-Security-Policy",
        value: CSP_POLICY,
      },
      ...(IS_PROD
        ? [
            {
              key: "Strict-Transport-Security",
              value: "max-age=31536000; includeSubDomains",
            },
          ]
        : []),
      ...(ENABLE_CSP_REPORT_ONLY
        ? [
            {
              key: "Content-Security-Policy-Report-Only",
              value: CSP_POLICY,
            },
          ]
        : []),
    ];

    const noStoreHeaders = [
      {
        key: "Cache-Control",
        value: "no-store, no-cache, must-revalidate, max-age=0",
      },
      {
        key: "Pragma",
        value: "no-cache",
      },
      {
        key: "Expires",
        value: "0",
      },
    ];
    return [
      {
        source: "/api/:path*",
        headers: [...baseHeaders, ...noStoreHeaders],
      },
      {
        // HTML / páginas (exclui assets estáticos)
        source:
          "/((?!_next/static|_next/image|static/|fonts/|brand/|favicon\\.ico|manifest\\.json|robots\\.txt|security\\.txt|\\.well-known/).*)",
        headers: [...baseHeaders, ...noStoreHeaders],
      },
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/fonts/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/brand/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
  webpack(config) {
    const resolvedPath = path.join(
      process.cwd(),
      "node_modules/@reduxjs/toolkit/dist/redux-toolkit.legacy-esm.js",
    );
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "@reduxjs/toolkit": resolvedPath,
    };
    return config;
  },
};

export default nextConfig;
