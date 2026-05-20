import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
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

    const { id, nombre, email, password, rol, meta_mensual, ciudad, celular } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'ID de usuario requerido.' }, { status: 400 })
    }

    // 1. Si viene password, actualizarlo en Auth, junto con el email
    const authUpdate = { email, email_confirm: true }
    if (password && password.trim() !== '') {
      authUpdate.password = password
    }

    const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(id, authUpdate)
    if (authErr) throw authErr

    // 2. Actualizar en la tabla 'profiles'
    const { error: profileErr } = await supabaseAdmin
      .from('profiles')
      .update({
        nombre,
        email,
        rol: rol || 'operativo',
        meta_mensual: parseFloat(meta_mensual) || 0,
        ciudad: ciudad || null,
        celular: celular || null
      })
      .eq('id', id)

    if (profileErr) throw profileErr

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error editing user:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
