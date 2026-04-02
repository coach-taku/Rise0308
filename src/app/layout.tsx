import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import './globals.css'

// PWA用メタデータ設定
export const metadata: Metadata = {
  title: 'RISE NOTE',
  description: '本気になれば、何者にもなれる - KUKI GYMRATS 練習ノートアプリ',
  // manifest.json への参照
  manifest: '/manifest.json',
  // Apple Touch Icon（iOS ホーム画面アイコン）
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'RISE NOTE',
  },
  // ファビコン設定
  icons: {
    icon: [
      { url: '/icons/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      { rel: 'icon', url: '/favicon.ico' },
    ],
  },
  // OGP / SNSシェア用設定
  openGraph: {
    title: 'RISE NOTE',
    description: '本気になれば、何者にもなれる - KUKI GYMRATS 練習ノートアプリ',
    type: 'website',
  },
}

// ビューポート設定
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  // iOS ステータスバーをアプリカラーに合わせる
  themeColor: '#000000',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        {/* iOS PWA スタンドアロンモード対応 */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="RISE NOTE" />
        {/* Android / Chrome PWA 用テーマカラー */}
        <meta name="mobile-web-app-capable" content="yes" />
        {/* msapplication（Windows / Edge 用） */}
        <meta name="msapplication-TileColor" content="#000000" />
        <meta name="msapplication-tap-highlight" content="no" />
      </head>
      <body className="min-h-screen">
        {children}
        {/* Service Worker 登録スクリプト */}
        <Script id="register-sw" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker
                  .register('/sw.js', { scope: '/' })
                  .then(function(registration) {
                    console.log('[SW] 登録成功:', registration.scope);
                  })
                  .catch(function(error) {
                    console.error('[SW] 登録失敗:', error);
                  });
              });
            }
          `}
        </Script>
      </body>
    </html>
  )
}
