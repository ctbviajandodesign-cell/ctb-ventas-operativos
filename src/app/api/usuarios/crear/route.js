import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Evitar pre-rendering estático de esta ruta en el build
export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    // Instanciamos el cliente DENTRO del handler para que no se ejecute en build time
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

    const { email, password, nombre, meta_mensual, rol, ciudad } = await request.json()

    // 1. Crear el usuario en Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
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
          meta_mensual: parseFloat(meta_mensual) || 0, 
          rol: rol || 'operativo',
          ciudad: ciudad || null
        }
      ])

    if (profileError) throw profileError

    return NextResponse.json({ success: true, user: authData.user })

  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
