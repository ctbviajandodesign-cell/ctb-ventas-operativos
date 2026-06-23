import DashboardClient from '@/components/dashboard/DashboardClient'

export const metadata = {
  title: 'Dashboard | CTB Operativos y Ventas',
  description: 'Panel de control de métricas y cotizaciones de CTB Viajando',
}

export default function DashboardPage() {
  // Aquí podemos añadir lógica de validación de sesión a nivel de servidor si se migra a @supabase/ssr en el futuro.
  return <DashboardClient />
}
