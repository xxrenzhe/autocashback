/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  transpilePackages: ["@autocashback/ui", "@autocashback/domain", "@autocashback/db"]
};

export default nextConfig;
