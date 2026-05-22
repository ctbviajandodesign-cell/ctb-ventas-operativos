import { supabase } from '@/lib/supabase'

export async function logActivity(action, details) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('nombre, email')
      .eq('id', user.id)
      .single()

    await supabase.from('logs_actividad').insert([{
      usuario_id: user.id,
      usuario_nombre: profile?.nombre || 'Desconocido',
      usuario_email: user.email || profile?.email || '',
      accion: action,
      detalles: details
    }])
  } catch (error) {
    console.error('Failed to log activity:', error)
  }
}
