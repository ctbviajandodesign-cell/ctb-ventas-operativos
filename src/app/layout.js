import { Outfit } from 'next/font/google'
import './globals.css'

const outfit = Outfit({ 
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-outfit',
})

export const metadata = {
  title: 'CTB VIAJANDO - Sistema de Ventas',
  description: 'Sistema interno de gestión de ventas y operativos para CTB Viajando',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={`${outfit.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
