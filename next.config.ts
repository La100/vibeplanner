import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // Exclude backup and chrome-extension folders from compilation
    config.resolve.alias = {
      ...config.resolve.alias,
    };
    
    config.module.rules.push({
      test: /\.(js|jsx|ts|tsx)$/,
      exclude: [
        /node_modules/,
        /backup/,
        /chrome-extension/,
      ],
    });

    return config;
  },
  // Exclude backup and chrome-extension from page directory scanning
  pageExtensions: ['js', 'jsx', 'ts', 'tsx', 'md', 'mdx'],
};

export default nextConfig;
