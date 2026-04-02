/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // PWA用 Service Worker ファイルを public から直接配信
  // sw.js は public/sw.js に配置済み
  // manifest.json も public/manifest.json に配置済み
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            // Service Worker は常に最新版を取得させる
            value: 'public, max-age=0, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
