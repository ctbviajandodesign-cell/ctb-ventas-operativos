import './globals.css'

export const metadata = {
  title: 'CTB VIAJANDO - Sistema de Ventas',
  description: 'Sistema interno de gestión de ventas y operativos para CTB Viajando',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
