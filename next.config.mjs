/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    outputFileTracingIncludes: {
      "/api/marketing/creative": ["./lib/creative/fixtures/**/*"],
    },
  },
};
export default nextConfig;
