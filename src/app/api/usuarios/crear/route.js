import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Usamos la Service Role Key para tener permisos de administrador (crear usuarios)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function POST(request) {
  try {
    const { email, password, nombre, meta_mensual, rol } = await request.json()

    // 1. Crear el usuario en Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true // Confirmamos el email automáticamente
    })

    if (authError) throw authError

    // 2. Crear el perfil en la tabla 'profiles'
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert([
        { 
          id: authData.user.id, 
          email, 
          nombre, 
          meta_mensual: parseFloat(meta_mensual), 
          rol: rol || 'operativo' 
        }
      ])

    if (profileError) throw profileError

    return NextResponse.json({ success: true, user: authData.user })

  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
