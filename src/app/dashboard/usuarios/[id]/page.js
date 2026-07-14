import OperativeProfileClient from '@/components/dashboard/OperativeProfileClient'

export const metadata = {
  title: 'Perfil de Rendimiento | CTB Operativos y Ventas',
  description: 'Historial completo y métricas de rendimiento por operativo',
}

export default function OperativeProfilePage({ params }) {
  // `params.id` contains the UUID of the operative
  return <OperativeProfileClient operativeId={params.id} />
}
