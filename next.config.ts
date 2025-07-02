import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'vibeplanner.bb4be4706863711bab16632895c4fab3.r2.cloudflarestorage.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https', 
        hostname: 'img.clerk.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
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
