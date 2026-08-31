import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/claim",
        destination: "/earn",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
