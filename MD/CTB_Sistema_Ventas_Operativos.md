# CTB VIAJANDO — Sistema de Ventas Operativos
## Informe Técnico de Arquitectura y Desarrollo
**Desarrollado por Antigravity · 2025 · Confidencial**

---

## Stack rápido

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 14+ (App Router) |
| Backend / DB / Auth | Supabase (PostgreSQL + JWT + RLS) |
| Estilos | Tailwind CSS + shadcn/ui |
| Deploy | Vercel (CI/CD automático) |
| Control de versiones | GitHub (repositorio privado) |
| QR | librería qrcode o react-qr-code |
| Gráficos | Recharts |
| Formularios | React Hook Form + Zod |
| Fechas | date-fns |

---

## 1. Contexto Empresarial

### ¿Quién es CTB Viajando?

CTB Viajando es una operadora mayorista de turismo en Ecuador. Modelo B2B: no vende directamente al viajero final, sino que diseña y comercializa paquetes turísticos completos que las agencias aliadas venden a sus propios clientes.

**CTB ofrece a sus agencias:**
- Paquetes nacionales e internacionales (vuelos, hotel, traslados, actividades, seguro)
- Tarifas negociadas con proveedores internacionales
- Comisiones ya calculadas + documentación editable
- Soporte antes, durante y después del viaje
- Acompañamiento especial a agencias pequeñas o nuevas

### El problema que resuelve este sistema

Hoy los operativos gestionan su trabajo diario de forma manual o dispersa. Esto genera:
- Pérdida de seguimiento de cotizaciones abiertas sin respuesta
- Imposibilidad de medir en tiempo real cuánto vende cada operativo
- Dificultad para gerencia de identificar tendencias y problemas de conversión
- Falta de trazabilidad en bonos, comisiones y utilidades
- Ausencia de vouchers verificables digitalmente con QR

### Objetivo del sistema

Construir una plataforma web interna, responsiva y segura que centralice el registro de trabajo diario de los operativos, permita seguimiento de cotizaciones, registre ventas con todos sus campos financieros, genere vouchers verificables por QR, y provea dashboards inteligentes para operativos y gerencia.

> **Nombre:** CTB Ventas Operativos  
> **Tipo:** Aplicación web interna (SaaS privado)  
> **Usuarios:** 1 Admin + 3 a 5 operativos (escalable)  
> **Acceso:** Login usuario/contraseña individual  
> **Responsividad:** 100% mobile-first  
> **Idioma:** Español

---

## 2. Arquitectura Técnica

### 2.1 Infraestructura y flujo de deploy

```
Desarrollador → GitHub (push) → Vercel detecta cambio → Build automático → Producción
```

**Dos entornos:**
- `develop` → Vercel preview + Supabase de prueba
- `main` → Producción + Supabase real

Las claves sensibles (service role key de Supabase, credenciales de Drive) **nunca van en el código**, solo en Vercel Environment Variables.

### 2.2 Seguridad con Supabase

- Autenticación con **JWT** — cada operativo tiene credenciales únicas
- **Row Level Security (RLS)** a nivel de base de datos:
  - Operativo → solo VE y EDITA sus propios registros
  - Admin → VE y EDITA todo
  - Ruta pública del QR → expone solo campos específicos del voucher, sin datos financieros
- Contraseñas con **bcrypt** (Supabase Auth lo maneja internamente)
- Sesiones con expiración automática (recomendado: 8 horas por jornada)

### 2.3 Respaldo automático a Google Drive

Implementar un job diario (Supabase Edge Function o GitHub Actions) que exporte las tablas críticas a `.xlsx` y las suba a una carpeta compartida de Google Drive de CTB.

**Tablas a respaldar:**
- `cotizaciones` — historial completo con estados
- `ventas` — registros financieros completos
- `vouchers` — vouchers emitidos con estados
- `seguimientos` — bitácora de intentos de contacto

**Ruta de destino en Drive:** `CTB-Backup/YYYY-MM-DD/`

Esto garantiza que si el sistema sufre una interrupción, la información está intacta y consultable desde Google Sheets como modo de emergencia.

---

## 3. Módulos del Sistema

### MÓDULO 1 — Autenticación y Acceso

Pantalla de login minimalista con logo CTB. Sin registro público: solo el admin crea cuentas desde el panel de administración.

**Funcionalidades:**
- Login seguro con Supabase Auth (JWT)
- Sesión persistente configurable (8 horas recomendado)
- Redirección automática por rol: admin → `/admin/dashboard`, operativo → `/operativo/dashboard`
- Recuperación de contraseña por correo (flujo nativo de Supabase)
- Protección de rutas: sin sesión activa redirige al login
- Logout desde cualquier pantalla con confirmación

| Rol | Permisos |
|-----|----------|
| `admin` | Acceso total. Crea/edita/elimina usuarios, edita cualquier registro, ve reportes globales, configura metas. |
| `operativo` | Solo ve y gestiona sus propios registros. Dashboard con métricas personales. |
| `public` (QR) | Sin login. Ruta `/voucher/[codigo]` muestra solo datos básicos del voucher. |

---

### MÓDULO 2 — Cotizaciones *(corazón del sistema)*

#### Ciclo de vida de una cotización

```
ABIERTA → EN SEGUIMIENTO → GANADA → [genera Venta + Voucher opcional]
                         → PERDIDA → [registra motivo]
```

> **Contexto crítico:** Las cotizaciones turísticas tienen vigencia de horas por disponibilidad. Una cotización creada hoy puede quedar sin efecto mañana. Por eso el sistema alerta visualmente cuando una cotización lleva más de 24 horas sin actividad.

#### Formulario de creación — campos iniciales

| Campo | Descripción |
|-------|-------------|
| Código de cotización | Generado automáticamente. Formato: `CTB-2025-0001` (año + secuencial). No editable. |
| Fecha de creación | Timestamp automático del servidor. |
| Agencia | Nombre de la agencia que solicita. Texto libre o select con agencias frecuentes. |
| Destino | Texto libre o select configurable (Cartagena, Panamá, Punta Cana, etc.). |
| Fecha de viaje (desde) | Date picker. |
| Fecha de viaje (hasta) | Date picker. |
| Pasajeros | Campo dinámico. Botón `+` para agregar nombre, `−` para eliminar. Soporta grupos. |
| Operativo asignado | Automático: el operativo logueado. Admin puede reasignar. |
| Estado inicial | `ABIERTA` — asignado automáticamente. |
| Notas iniciales | Texto libre opcional. |

#### Módulo de seguimiento (bitácora por cotización)

Cada cotización tiene una sub-sección de seguimiento con historial cronológico visible para el operativo y el admin.

| Campo | Opciones / Descripción |
|-------|------------------------|
| Fecha y hora | Timestamp automático al registrar. |
| Tipo de contacto | `Llamada realizada` · `WhatsApp enviado` · `Correo enviado` · `Sin respuesta del cliente` · `Esperando confirmación de agencia` · `Revisando disponibilidad con operador` |
| Resultado del intento | `Positivo (avanzando)` · `Neutral (en espera)` · `Negativo (posible pérdida)` |
| Nota | Texto corto libre. Ej: *"Dijo que consulta con su cliente y responde mañana."* |

#### Cierre de cotización — decisión final

Al final del día (o cuando el operativo lo decida), la cotización se cierra:

- **SE VENDIÓ** → se despliega el formulario completo de venta (Módulo 3)
- **NO SE VENDIÓ** → se elige el motivo:

| Motivo (desplegable) |
|----------------------|
| Precio alto — cliente fuera de presupuesto |
| Agencia no cerró con su cliente final |
| Sin respuesta oportuna del operador/proveedor |
| Disponibilidad agotada al confirmar |
| Cliente postergó el viaje |
| Otro (campo de texto libre) |

---

### MÓDULO 3 — Ventas

Se activa automáticamente cuando una cotización se marca como **GANADA**.

#### Formulario completo de venta

| Campo | Tipo / Lógica |
|-------|---------------|
| N° Proforma | Texto manual. Código del proveedor. Ej: `S01262`. |
| Agencia | Heredado de la cotización. Editable. |
| Destino | Heredado. |
| Fechas de viaje | Heredadas. Editables. |
| Pasajeros | Lista heredada. Permite agregar/quitar al confirmar. |
| **Total ($)** | Monto total. Ingreso manual. |
| Abono tarjeta ($) | Pago con tarjeta. Puede ser 0. |
| Abono 1 ($) | Primer abono en efectivo o transferencia. |
| Abono 2 ($) | Segundo abono si aplica. Puede quedar vacío. |
| **Faltante ($)** | `CALCULADO`: Total − (Abono tarjeta + Abono 1 + Abono 2). 0 = pagado. |
| Estado de pago | `CALCULADO`: `PAGADO COMPLETO` si faltante = 0 · `PENDIENTE` si faltante > 0 |
| Bono Counter ($) | Bono del operativo por esta venta. **Ingreso manual** (varía por destino). |
| Bono Pagado | Toggle Sí/No. Indica si el bono ya fue liquidado al operativo. |
| Comisión ($) | Comisión de la venta. **Ingreso manual** (varía por destino/proveedor). |
| Utilidad ($) | Utilidad adicional. **Ingreso manual**. |
| **Meta computable ($)** | `CALCULADO`: Bono Counter + Utilidad. **Este es el valor que suma a la meta mensual.** |
| Voucher requerido | Toggle Sí/No. Si Sí, activa el Módulo 4. |
| Observaciones | Texto libre opcional. |

> **⚠️ Regla crítica de meta:** La meta mensual NO se mide sobre el total de la venta. Se mide sobre la suma de **Bono Counter + Utilidad** de cada venta. Esto refleja la ganancia real que el operativo genera para CTB.

---

### MÓDULO 4 — Vouchers y Validación QR

#### ¿Cuándo se genera un voucher?

No todas las ventas generan voucher. El operativo activa el toggle en el formulario de venta. Algunos destinos o tipos de servicio lo requieren, otros no.

#### Campos del voucher

| Campo | Tipo / Descripción |
|-------|--------------------|
| Código | `VCH-2025-0001` — generado automáticamente. Único. |
| Proforma vinculada | Heredada de la venta. |
| Pasajeros | Heredados. Editables. |
| Destino | Heredado. |
| Fechas de viaje | Heredadas. |
| Operativo emisor | Automático: nombre del operativo logueado. |
| Fecha de emisión | Timestamp automático. |
| Fecha de caducidad | Ingreso manual por el operativo. |
| Estado | `ACTIVO` · `USADO` · `NO USADO` · `INACTIVO` |
| Notas | Instrucciones especiales opcionales. |
| QR Code | Generado automáticamente. URL: `/voucher/VCH-2025-0001` |

#### Estados del voucher

| Estado | Descripción | ¿Quién lo cambia? |
|--------|-------------|-------------------|
| `ACTIVO` | Estado inicial. El viaje aún no ocurrió. | — |
| `USADO` | El viajero efectivamente realizó el viaje. | Operativo o Admin (manual) |
| `NO USADO` | El viajero no viajó pese al voucher. | Operativo o Admin (manual) |
| `INACTIVO` | Cancelado manualmente antes del viaje. | Admin o Operativo emisor |
| Alerta caducado | La fecha pasó y el estado sigue `ACTIVO`. El sistema muestra alerta visual pero NO cambia el estado automáticamente. Requiere confirmación del operativo: ¿USADO o NO USADO? | — |

#### Vista pública del QR — `/voucher/[codigo]`

Ruta pública sin login. Muestra tarjeta de verificación con:

✅ **Muestra:** Logo CTB · Código de voucher · Estado (badge de color) · Nombre(s) pasajero(s) · Destino · Fechas de viaje · Fecha de emisión y caducidad · Operativo que emitió · N° Proforma

❌ **No muestra:** Montos · Comisiones · Bonos · Utilidades · Datos de la agencia · Información comercial

---

### MÓDULO 5 — Dashboard del Operativo

> Responde en un vistazo tres preguntas: **¿Cuánto he vendido? ¿Cuánto me falta para mi meta? ¿Qué tengo pendiente hoy?**

#### Sección 1 — Resumen del período *(selector: Hoy / Semana / Mes)*

| Métrica | Descripción |
|---------|-------------|
| Total vendido ($) | Suma de (Bono Counter + Utilidad) del período. |
| Meta del mes ($) | Meta asignada. Barra de progreso visual. |
| **Falta para meta ($)** | *"Te faltan $X para llegar a tu meta mensual."* Verde si ya la alcanzó. |
| Cotizaciones creadas | Número total del período. |
| Cotizaciones vendidas | Número de cotizaciones → GANADAS. |
| Tasa de conversión (%) | Vendidas / Creadas × 100. |
| Cotizaciones abiertas | Sin cerrar. Alerta si hay alguna de más de 24 horas. |
| Bonos acumulados ($) | Suma de bonos counter del período. Indicador si están pagados o pendientes. |

#### Sección 2 — Lista de cotizaciones del día

Tabla compacta ordenada por hora. Cada fila: código · agencia · destino · estado (badge de color) · acciones rápidas (ver detalle, seguimiento, cerrar como ganada/perdida).

#### Sección 3 — Tendencias históricas

Gráfico de línea: total vendido mes a mes. Visible con al menos 2 meses de datos. Permite identificar temporadas altas y bajas.

#### Sección 4 — Vouchers activos del operativo

Lista con estado actual. Alerta visual para vouchers que caducan en menos de 7 días y para los que ya vencieron sin confirmación de uso.

---

### MÓDULO 6 — Dashboard de Gerencia / Admin

#### Vista global — todos los operativos

| Sección | Contenido |
|---------|-----------|
| Resumen general del mes | Total vendido por el equipo. Ventas, cotizaciones, tasa de conversión global. |
| **Ranking de operativos** | Tabla: operativo · ventas del mes · meta · % cumplimiento · bonos. Ordenable. |
| Barra de meta por operativo | Verde = cumplió · Amarillo = en camino · Rojo = rezagado. |
| Destinos más vendidos | Top 5 del mes. Gráfico de barras con montos. |
| **Motivos de no venta** | Gráfico de torta con motivos frecuentes. Identifica patrones de pérdida. |
| Cotizaciones sin cerrar | Alerta: abiertas +24h sin actividad, con operativo responsable. |
| Vouchers por vencer | Lista de vouchers que caducan en los próximos 7 días. |
| Comparativa histórica | Ventas mensuales por operativo. Visualiza evolución y temporadas. |

#### Gestión de usuarios *(solo admin)*

Crear operativos (nombre, correo, contraseña temporal, meta mensual), editar datos, cambiar meta en cualquier momento, ver todos los registros de cualquier operativo, editar o eliminar cualquier cotización/venta/voucher.

#### Exportación de reportes

| Reporte | Formato | Contenido |
|---------|---------|-----------|
| Ventas del mes | PDF | Tabla de ventas, filtrable por operativo. Subtotales y totales. |
| Cotizaciones | Excel / PDF | Todas las cotizaciones (ganadas y perdidas) con sus seguimientos. |
| Bonos y comisiones | PDF | Detalle de bonos por operativo del mes. Para liquidación de pagos. |
| Vouchers | PDF | Estado actual de todos los vouchers. Filtrable por estado y período. |
| Exportación completa | Excel | Todas las tablas del sistema para el período seleccionado. |

---

## 4. Esquema de Base de Datos — Supabase PostgreSQL

> Todas las tablas tienen `created_at` y `updated_at` automáticos. El campo `id` es UUID generado por Supabase.

### Tabla: `usuarios`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID PK | Vinculado a Supabase Auth. |
| `nombre` | TEXT | Nombre completo. |
| `email` | TEXT UNIQUE | Correo de acceso. |
| `rol` | TEXT | `'admin'` o `'operativo'`. |
| `meta_mensual` | NUMERIC | Meta mensual en dólares. |
| `activo` | BOOLEAN | Si `false`, no puede ingresar. |
| `created_at` | TIMESTAMPTZ | Automático. |

### Tabla: `cotizaciones`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID PK | — |
| `codigo` | TEXT UNIQUE | `CTB-2025-0001`. Secuencial por año. |
| `operativo_id` | UUID FK → usuarios | Quién creó la cotización. |
| `agencia` | TEXT | Nombre de la agencia. |
| `destino` | TEXT | Destino del viaje. |
| `fecha_viaje_desde` | DATE | Inicio del viaje. |
| `fecha_viaje_hasta` | DATE | Fin del viaje. |
| `pasajeros` | JSONB | Array. Ej: `[{"nombre": "Juan Pérez"}]` |
| `estado` | TEXT | `'abierta'` · `'en_seguimiento'` · `'ganada'` · `'perdida'` |
| `motivo_no_venta` | TEXT NULL | Solo cuando estado = `'perdida'`. |
| `notas_iniciales` | TEXT NULL | Contexto inicial. |

### Tabla: `seguimientos`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID PK | — |
| `cotizacion_id` | UUID FK → cotizaciones | — |
| `operativo_id` | UUID FK → usuarios | — |
| `tipo_contacto` | TEXT | `'llamada'` · `'whatsapp'` · `'correo'` · `'sin_respuesta'` · `'esperando_agencia'` · `'revisando_disponibilidad'` |
| `resultado` | TEXT | `'positivo'` · `'neutral'` · `'negativo'` |
| `nota` | TEXT NULL | Texto libre del operativo. |
| `created_at` | TIMESTAMPTZ | Momento del registro. |

### Tabla: `ventas`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID PK | — |
| `cotizacion_id` | UUID FK → cotizaciones | Relación 1:1. |
| `operativo_id` | UUID FK → usuarios | — |
| `numero_proforma` | TEXT | Código del proveedor. |
| `total` | NUMERIC | Monto total de la venta. |
| `abono_tarjeta` | NUMERIC DEFAULT 0 | — |
| `abono_1` | NUMERIC DEFAULT 0 | — |
| `abono_2` | NUMERIC DEFAULT 0 | — |
| `faltante` | NUMERIC GENERATED | `total − (abono_tarjeta + abono_1 + abono_2)` |
| `bono_counter` | NUMERIC DEFAULT 0 | Bono del operativo. Manual. |
| `bono_pagado` | BOOLEAN DEFAULT false | Si el bono fue liquidado. |
| `comision` | NUMERIC DEFAULT 0 | Manual. |
| `utilidad` | NUMERIC DEFAULT 0 | Manual. |
| `meta_computable` | NUMERIC GENERATED | `bono_counter + utilidad` ← **base para la meta** |
| `requiere_voucher` | BOOLEAN DEFAULT false | — |
| `observaciones` | TEXT NULL | — |

### Tabla: `vouchers`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID PK | — |
| `codigo` | TEXT UNIQUE | `VCH-2025-0001`. Secuencial. |
| `venta_id` | UUID FK → ventas | Relación 1:1. |
| `operativo_id` | UUID FK → usuarios | Quien emitió. |
| `numero_proforma` | TEXT | Heredado de la venta. |
| `pasajeros` | JSONB | Array de nombres. |
| `destino` | TEXT | — |
| `fecha_viaje_desde` | DATE | — |
| `fecha_viaje_hasta` | DATE | — |
| `fecha_caducidad` | DATE | Ingreso manual. |
| `estado` | TEXT | `'activo'` · `'usado'` · `'no_usado'` · `'inactivo'` |
| `notas` | TEXT NULL | Instrucciones especiales. |
| `qr_url` | TEXT | URL pública completa del voucher. |

---

## 5. Diseño y UX

### Principios

- **Mobile-first:** diseño desde 375px hacia arriba
- **Claridad sobre densidad:** menos información, más clara
- **Colores semánticos:** verde = bien · amarillo = atención · rojo = alerta · azul = neutral
- **Acciones principales siempre visibles:** sin CTAs escondidos en submenús
- **Feedback inmediato:** toast de confirmación o error en cada acción

### Paleta de colores

| Color | Hex | Uso |
|-------|-----|-----|
| Primario | `#0066CC` | Botones principales, headers, links |
| Acento | `#FF6600` | Alertas, badges de atención, metas |
| Éxito | `#16A34A` | Ganadas, meta cumplida, voucher usado |
| Peligro | `#DC2626` | Perdidas, voucher vencido sin confirmar |
| Texto | `#1A1A2E` | Texto principal |
| Fondo | `#F5F7FA` | Fondo de la app |
| Superficie | `#FFFFFF` | Cards y paneles |

### Componentes shadcn/ui recomendados

| Componente | Uso |
|------------|-----|
| `DataTable` | Cotizaciones y ventas con paginación, búsqueda y ordenamiento |
| `Dialog` | Formularios de creación/edición sin salir de la pantalla |
| `Badge` | Estados de cotizaciones y vouchers con color semántico |
| `Progress` | Barra de avance hacia la meta mensual |
| `Toast / Sonner` | Notificaciones de éxito/error |
| `DatePicker` | Fechas de viaje y caducidad de voucher |
| `Select / Combobox` | Agencias, destinos, motivos de no venta |
| `Tabs` | Cambio entre Hoy / Semana / Mes en el dashboard |
| `Card` | Métricas del dashboard con número grande |
| `Sheet (drawer)` | Panel deslizable para formularios de seguimiento en móvil |

---

## 6. Fases de Desarrollo

### FASE 1 — Fundamentos *(Semanas 1–2)*
- Configuración del repositorio en GitHub (estructura Next.js)
- Configuración de Supabase: tablas, RLS, Auth
- Configuración de Vercel: dominio, variables de entorno, deploy automático
- Módulo de autenticación: login, logout, protección de rutas, roles
- Módulo de cotizaciones: crear, listar, ver detalle
- Módulo de seguimientos: registrar intentos por cotización
- Cierre de cotización: ganada o perdida con motivo

### FASE 2 — Ventas y Vouchers *(Semanas 3–4)*
- Formulario completo de venta con todos los campos financieros
- Cálculo automático de faltante y meta_computable
- Módulo de vouchers: crear, estados, gestión
- Generación de QR code por voucher
- Ruta pública `/voucher/[codigo]` sin login
- Vista de impresión/PDF del voucher

### FASE 3 — Dashboards e Inteligencia *(Semanas 5–6)*
- Dashboard del operativo: métricas día/semana/mes
- Barra de progreso de meta mensual en tiempo real
- Dashboard de gerencia: ranking, comparativas, alertas
- Gráficos de tendencias con Recharts
- Filtros por período en todas las vistas
- Alertas automáticas: cotizaciones abiertas +24h, vouchers por vencer

### FASE 4 — Exportación y Backup *(Semana 7)*
- Exportación de reportes en PDF
- Exportación de datos en Excel
- Backup automático diario a Google Drive
- Módulo de administración de usuarios por el admin
- Gestión de metas por operativo desde el panel admin
- Pruebas de carga, optimización y ajustes finales

---

## 7. Consideraciones Técnicas Críticas

### Variables de entorno necesarias

| Variable | Descripción |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL pública del proyecto Supabase. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anónima pública (cliente). |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave privada de servicio. **NUNCA en el cliente.** |
| `NEXT_PUBLIC_APP_URL` | URL base de la app. Usada para generar URLs de QR. |
| `GOOGLE_DRIVE_SERVICE_ACCOUNT` | Credenciales JSON para backups automáticos a Drive. |

### Reglas RLS en Supabase

```sql
-- cotizaciones
SELECT/INSERT/UPDATE donde operativo_id = auth.uid()  (o rol = 'admin')

-- ventas
SELECT/INSERT/UPDATE donde operativo_id = auth.uid()  (o rol = 'admin')

-- seguimientos
SELECT/INSERT donde operativo_id = auth.uid()  (o rol = 'admin')

-- vouchers
SELECT abierto para ruta pública QR
INSERT/UPDATE donde operativo_id = auth.uid()  (o rol = 'admin')

-- usuarios
Solo admin puede INSERT/UPDATE/DELETE
```

### Performance y escalabilidad

- Agregar índices en `operativo_id`, `estado`, `created_at` en cotizaciones y ventas
- Las consultas del dashboard usan agregaciones en el servidor (Supabase RPC o Edge Functions), no traer todos los registros al cliente
- Next.js con React Server Components: datos en servidor → solo HTML al cliente → velocidad en móvil
- Paginación en tablas desde la Fase 1. Nunca más de 50 registros por carga

### Checklist pre-launch

| Ítem | Acción |
|------|--------|
| RLS activado | Verificar que todas las tablas tienen RLS habilitado en Supabase |
| Variables de entorno | Confirmar que `SUPABASE_SERVICE_ROLE_KEY` no está expuesta al cliente |
| Dominio personalizado | Configurar en Vercel (ej: `ventas.ctbviajando.com`) |
| Backup inicial | Hacer backup manual antes del primer uso real |
| Prueba de QR | Verificar QR en iOS y Android reales |
| Prueba móvil | Probar todos los formularios en dispositivos reales, no solo simuladores |
| Creación de usuarios | Crear cuentas de operativos y admin antes del go-live |
| Metas configuradas | Asignar meta mensual a cada operativo desde el panel admin |

---

*CTB Viajando — Informe Técnico Confidencial — 2025 — Construido con Antigravity + Claude*
