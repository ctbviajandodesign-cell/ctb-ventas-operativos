# Informe de Auditoría de Sistemas: CTB Ventas Operativos

**Destinatario:** Equipo de Auditoría Interna / Externa  
**Materia:** Revisión de Arquitectura, Controles de Acceso y Trazabilidad Financiera  
**Fecha de Emisión:** Junio 2026  

---

## 1. Objetivo del Informe
El presente documento tiene como finalidad explicar la arquitectura, los controles lógicos y la trazabilidad de datos del sistema "CTB Ventas Operativos". Está estructurado para responder a los requerimientos de auditoría relacionados con la seguridad de la información, segregación de funciones y control financiero.

---

## 2. Arquitectura Tecnológica y Almacenamiento

El sistema opera bajo un modelo de Software as a Service (SaaS) privado, estructurado en dos capas principales:

- **Frontend (Interfaz de Usuario):** Desarrollado en Next.js y alojado en la infraestructura en la nube de Vercel.
- **Backend y Base de Datos:** Gestionado mediante Supabase, utilizando **PostgreSQL** como motor de base de datos relacional. 

> [!NOTE]
> **Aislamiento de Datos:** Toda la información transaccional reside en la nube bajo los estándares de seguridad de Supabase (AWS subyacente), con encriptación en tránsito (TLS/SSL) y en reposo.

---

## 3. Controles de Acceso y Segregación de Funciones

El sistema implementa un estricto modelo de Control de Acceso Basado en Roles (RBAC) gestionado por JSON Web Tokens (JWT) y políticas a nivel de base de datos (Row Level Security - RLS).

### Roles Definidos
1. **Administrador (`admin`):**
   - Acceso irrestricto de lectura y escritura a nivel aplicativo.
   - Único rol con capacidad de crear, modificar o desactivar cuentas de usuarios (operativos).
   - Capacidad de modificar metas financieras de los usuarios.
2. **Operativo (`operativo`):**
   - **Restricción RLS:** Las políticas de la base de datos bloquean estrictamente que un operativo consulte o modifique registros (Cotizaciones, Ventas, Vouchers) creados por otros operativos.
   - Acceso limitado únicamente a su propio panel de rendimiento y transacciones.
3. **Público (Validación QR):**
   - Acceso anónimo de solo lectura a una vista muy reducida de la tabla `vouchers`.
   - **Control Crítico:** Por diseño, el endpoint público omite por completo cualquier campo financiero (montos, comisiones, utilidades) y datos de la agencia B2B. Solo expone la validez del voucher y nombres de pasajeros.

---

## 4. Trazabilidad Transaccional (Audit Trail)

El sistema garantiza el rastreo de cada solicitud comercial desde su inicio hasta su resolución financiera:

### 4.1 Trazabilidad de Gestión (Cotizaciones)
- Toda cotización generada recibe un **código secuencial inmutable** (Ej. `CTB-2025-0001`) y un sello de tiempo automático (`created_at`).
- **Bitácora de Seguimiento:** Cualquier interacción con el cliente queda registrada en la tabla `seguimientos`, con su respectivo timestamp y usuario ejecutor.
- Toda cotización debe cerrarse lógicamente como `Ganada` o `Perdida`. Las perdidas requieren obligatoriamente la tipificación del motivo, impidiendo el abandono de registros sin justificación.

### 4.2 Trazabilidad Financiera (Ventas)
Las operaciones marcadas como `Ganadas` se transforman en entidades de `Ventas`. Para propósitos de auditoría contable, los campos se manejan de la siguiente forma:
- Se registra de manera atómica el **Total de la Venta** frente a los **Abonos** recibidos (Tarjeta, Efectivo 1, Efectivo 2).
- **Cálculo de Deuda Autogenerado:** El campo `faltante` no es editable por el usuario; es un campo generado (calculado) por la base de datos (`total - sum(abonos)`). Esto previene alteraciones manuales del saldo deudor.
- **Separación del Rendimiento:** Los incentivos del personal (`Bono Counter` y `Utilidad`) se ingresan por separado para calcular de forma transparente el indicador `meta_computable`. Esta métrica es auditable fila por fila.

---

## 5. Continuidad de Negocio y Respaldo (Disaster Recovery)

> [!TIP]
> **Doble Capa de Backup:**
> Además de los respaldos automáticos por defecto provistos por la infraestructura de Supabase (PostgreSQL PITR - Point-in-Time Recovery), el sistema está diseñado para integrarse con **Google Sheets / Google Drive**. 

- Existe una rutina de sincronización para exportar los datos transaccionales de `ventas` y `cotizaciones` hacia un documento de Excel en Google Drive corporativo. 
- Este control mitiga el riesgo de pérdida de acceso a la base de datos primaria, garantizando que el personal siempre disponga de una versión tabular, legible y filtrable de las operaciones cerradas.

---

## 6. Conclusión de Auditoría
El sistema "CTB Ventas Operativos" presenta controles adecuados y suficientes para mitigar riesgos de fugas de información interna. Su dependencia en `Row Level Security` (RLS) en PostgreSQL garantiza que las restricciones de acceso no dependan del frontend (fácilmente eludible), sino que se apliquen en la capa más profunda de la arquitectura de datos. Asimismo, la generación calculada de saldos asegura la integridad aritmética de las transacciones financieras.
