/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack(config) {
    // pdf.js / docx reference Node built-ins that are not needed in the browser
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      stream: false,
      canvas: false,
    };
    return config;
  },
};

module.exports = nextConfig;
