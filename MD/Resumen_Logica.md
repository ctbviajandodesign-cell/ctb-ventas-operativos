# Análisis de la Lógica del Sistema CTB

El sistema "CTB Ventas Operativos" es una plataforma B2B diseñada para digitalizar y centralizar el trabajo de los operativos de ventas turísticas. Su lógica principal gira en torno a controlar todo el embudo de ventas: desde que un cliente (agencia) pide un precio, hasta que se cobra la venta y se emite un voucher.

A continuación, un análisis simplificado de la lógica por cada fase del proceso:

## 1. El Embudo de Negocio (El Flujo Principal)

El corazón del sistema es cómo avanza una solicitud de viaje. Todo sigue este ciclo:

1. **Cotización Abierta:** El operativo recibe un pedido de una agencia y crea una cotización (genera un código único ej: `CTB-2025-0001`).
2. **Seguimiento (Bitácora):** Cada vez que el operativo llama, envía un WhatsApp o un correo a la agencia, lo registra en el sistema. Esto deja un historial de qué tan "caliente" está la venta y evita que se olviden de hacer seguimiento. El sistema alerta si pasan 24 horas sin actividad.
3. **Decisión Final:** La cotización debe cerrarse con uno de dos resultados:
   - **Perdida:** Se registra por qué no se vendió (precio alto, sin disponibilidad, etc.). Esto da métricas valiosas a gerencia.
   - **Ganada:** Inmediatamente se abre el formulario para convertirla en una **Venta**.

> [!NOTE]
> Esta estructura asegura que ninguna solicitud quede "en el aire". O se gana o se pierde, y siempre hay un responsable.

## 2. La Lógica Financiera y de Metas (Ventas)

Cuando una cotización se vuelve Venta, la lógica cambia hacia la parte contable y de rendimiento del empleado:

- **Estructura de la Venta:** Se desglosa en el costo total, los abonos (tarjeta, efectivo, etc.) y se calcula automáticamente la deuda restante (**Faltante**).
- **Las Ganancias (Comisión, Utilidad y Bono):** Se separan los montos de lo que gana la empresa y lo que gana el empleado (Bono Counter).
- **La Meta Mensual (Crítico):** El sistema **no** evalúa al operativo por el monto bruto vendido (porque gran parte de ese dinero es para pagar la aerolínea o el hotel), sino por la suma del **Bono Counter + la Utilidad**. Ese es el valor real que mueve la aguja de la barra de progreso de su meta mensual.

## 3. Emisión de Vouchers y Seguridad (QR)

Si el viaje se confirma, el sistema emite un Voucher digital.

- **Generación Automática:** Hereda los datos de la venta y genera un código único (ej: `VCH-2025-0001`).
- **Verificación Inteligente:** Genera un Código QR que lleva a una URL pública. 
- **Privacidad:** La lógica de seguridad (RLS en Supabase) garantiza que si un pasajero o agencia escanea el QR, **solo ve que el voucher es válido, las fechas y los pasajeros**. El sistema oculta por completo los montos, comisiones o utilidades para evitar que el cliente final vea los márgenes de ganancia.

## 4. Paneles de Control (Dashboards)

El sistema tiene dos vistas lógicas dependiendo de quién entra:

### Lógica del Operativo
- Solo ve **su propia información**.
- El dashboard responde a: *¿Cuánto he ganado hoy? ¿Qué cotizaciones tengo olvidadas? ¿Ya llegué a mi meta del mes?*

### Lógica de Gerencia / Admin
- Ve **todo**.
- Su dashboard está enfocado en la comparación: Ranking de mejores vendedores, destinos estrella, y gráficas de motivos por los que se están perdiendo ventas, para poder tomar decisiones de negocio.

## 5. Lógica Técnica y Arquitectura

- **Frontend Rápido:** Construido con Next.js y TailwindCSS, priorizando el uso desde celulares (Mobile-first) para que el operativo pueda trabajar desde cualquier lugar.
- **Base de Datos Segura:** Supabase (PostgreSQL) maneja la autenticación. La regla "Row Level Security" hace imposible que un operativo hackee el sistema para ver las comisiones de sus compañeros.
- **Respaldo (Backup):** La arquitectura planea una conexión de respaldo a Google Sheets (lo que estuvimos configurando) para que, pase lo que pase, la data siempre exista en un formato tradicional.
