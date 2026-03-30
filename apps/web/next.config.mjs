/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3"]
  },
  transpilePackages: ["@autocashback/ui", "@autocashback/domain", "@autocashback/db"]
};

export default nextConfig;
