import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const args = process.argv.slice(2);
if (args.length < 3) {
  console.log("Uso: node create-superadmin.js <email> <password> <nombre>");
  console.log("Ejemplo: node create-superadmin.js admin@admin.com 123456 \"Admin Principal\"");
  process.exit(1);
}

const email = args[0];
const password = args[1];
const nombre = args[2];

async function createSuperAdmin() {
  try {
    console.log(`Buscando / Creando superadmin: ${email}...`);
    
    // 1. Verificar si ya existe en auth
    const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;
    
    let user = listData.users.find(u => u.email === email);

    if (user) {
        console.log(`El usuario ya existe en Auth (ID: ${user.id}). Actualizando su contraseña y rol...`);
        // Actualizamos password si lo requiere
        const { error: updateAuthErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, { password });
        if (updateAuthErr) console.error("Error al actualizar la contraseña (quizás ya es la misma).", updateAuthErr.message);
    } else {
        // Crear nuevo usuario en auth
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true
        });
        if (authError) throw authError;
        user = authData.user;
        console.log(`Usuario creado en Auth con éxito (ID: ${user.id})`);
    }

    // 2. Crear o actualizar el perfil en la tabla 'profiles'
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({ 
        id: user.id, 
        email: email, 
        nombre: nombre, 
        rol: 'superadmin'
      });

    if (profileError) {
      throw profileError;
    }
    
    console.log(`¡Superadmin configurado con éxito! Ahora puedes iniciar sesión con:`);
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);

  } catch (error) {
    console.error('Error:', error.message || error);
  }
}

createSuperAdmin();
