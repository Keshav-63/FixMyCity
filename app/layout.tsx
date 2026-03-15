import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { AuthProvider } from '@/components/providers/auth-provider'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Civic Issue Reporter | Report & Track Local Issues',
  description: 'Help improve your community by reporting and tracking civic issues like potholes, trash, water leaks, and more. Join neighbors in making your area better.',
  keywords: ['civic', 'issues', 'report', 'community', 'pothole', 'trash', 'local government'],
  authors: [{ name: 'Civic Reporter Team' }],
  openGraph: {
    title: 'Civic Issue Reporter',
    description: 'Report and track civic issues in your community',
    type: 'website',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0F172A',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
