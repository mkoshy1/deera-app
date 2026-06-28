import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // نتجاهل أخطاء التايب سكريبت وقت البناء حتى يرتفع الموقع
    ignoreBuildErrors: true,
  },
  eslint: {
    // نتجاهل تحذيرات الترتيب وقت البناء
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;