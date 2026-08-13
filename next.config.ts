import type { NextConfig } from "next";
import { getSecurityHeaders } from "./lib/security-headers";

const nextConfig: NextConfig = {
  serverExternalPackages: ["web-push"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: getSecurityHeaders(),
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/s/minha-loja",
        destination: "/",
        permanent: true,
      },
      {
        source: "/s/minha-loja/:path*",
        destination: "/:path*",
        permanent: true,
      },
      {
        source: "/s/saboart",
        destination: "/",
        permanent: true,
      },
      {
        source: "/s/saboart/:path*",
        destination: "/:path*",
        permanent: true,
      },
      {
        source: "/s/:slug",
        destination: "/",
        permanent: false,
      },
      {
        source: "/s/:slug/:path*",
        destination: "/:path*",
        permanent: false,
      },
    ];
  },
  turbopack: {},
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
  allowedDevOrigins: [
    "10.0.2.2",
    "10.0.2.2:3000",
    "192.168.0.6",
    "192.168.0.6:3000",
    "127.0.0.1",
    "127.0.0.1:3000",
  ],
};

export default nextConfig;
