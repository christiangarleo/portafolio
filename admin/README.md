# CV personalizados — guía operativa vigente

## Objetivo
Desde https://christianarleo.com/portafolio/ el reclutador ingresa el RUC (11 dígitos) y abre **siempre una página dedicada**: https://christianarleo.com/empresa/?ruc=<RUC> (el RUC es público y no autentica).
- **0 CV registrados/activos:** la página muestra formularios de solicitud de CV / in-house / proyecto.
- **1 o más CV asociados al RUC:** se muestra el portal de la empresa con todas las vacantes vinculadas a CV activos, incluso cuando hay uno solo. Cada tarjeta ofrece la descarga bajo demanda de su CV vigente.
- **CV vencidos:** visibles como historial del portal, sin descarga.
- No mostrar el **estado de postulación** del registro interno al reclutador, ni URLs permanentes de Storage.
- El panel privado de administración ofrece «Abrir portal de la empresa» para comprobar la experiencia del reclutador.

## Componentes y fuente de verdad
- Frontend público: `portafolio/index.html`, `portafolio/cv-portal.js`; portal por empresa: `empresa/index.html`, `empresa/empresa.js`.
- Lector PDF público: `portafolio/lector-v10.js` (no modificar al evolucionar los CV).
- Administración privada: `admin/index.html` y `admin/panel.js`, https://christianarleo.com/admin/.
- Supabase: proyecto `gprhevdotoykofrxbufv`, Edge Function `portfolio-cv-portal`; fuente versionada de función en `supabase/functions/portfolio-cv-portal/index.ts`.
- Tablas: `public.portfolio_cv_admins`, `public.portfolio_cv_documents`, `public.portfolio_cv_leads`.
- Bucket privado `cv-personalizados` (mantener aparte de `portafolio`, el bucket público).
- Campo nuevo ejecutado en producción: `public.portfolio_cv_documents.application_status` (por defecto `preparado`; permitidos `preparado`, `postulado`, `en_proceso`, `finalizado`). Es **solo interno**.
- `role_name` representa la **vacante**, editable posteriormente con «Editar vacante».
- `is_main` solo prioriza orden del portal. NO excluye otros CV del mismo RUC. No se usa para descargar automáticamente.

## Administración
1. Acceder con la cuenta verificada y autorizada en Supabase Auth; la autorización vive en `portfolio_cv_admins` con RLS.
2. Subir archivo PDF (máximo 30 MB), empresa, RUC, puesto, fecha de vencimiento opcional y estado interno.
3. Ver/editar postulación en el listado: cambiar estado, editar nombre de vacante, seleccionar principal, activar/desactivar y eliminar.
4. Si un RUC tiene varios CV, no borrar los alternativos: se muestran por vacante; los vencidos aparecen como «No disponible».
5. Archivo recién subido: ruta única con UUID, para evitar colisiones de nombres y versiones.
6. Revocar el acceso desactivando el registro; los enlaces de descarga generados tienen un TTL máximo de 90 segundos.

## Contratos de la función
- `POST {action:"resolve",ruc:"<11 dígitos>"}`:
  - `{status:"not_found"}` si no existen CV activos registrados;
  - `{status:"company",company,items:[{id,position,expires_at,available}]}` si existe uno o más CV activos, incluidos los vencidos.
- `POST {action:"download",ruc,id}`: valida que el CV pertenezca al RUC, esté activo y vigente, y genera enlace firmado de 90 segundos.
- `POST {action:"lead",...}`: registra la solicitud en `portfolio_cv_leads`.
- No se devuelve URL firmada al consultar RUC, **solo al pulsar Descargar en la tarjeta elegida**.
- No devolver rutas privadas de Storage, estados internos ni claves secretas al frontend.

## Formularios comerciales v2 (23-11-2026)
- **Únicos dos caminos públicos:** «Contratación In-house» y «Contratación por proyecto». Se retiró «Solicitar CV personalizado» de la interfaz; se conserva la acción antigua `lead` en la función para compatibilidad con navegadores que todavía tengan caché de la versión anterior.
- **Flujo de dos etapas:** 1) datos de empresa/contacto (RUC tomado de la URL); 2) detalles según modalidad, preferencia de contacto y observaciones.
- **In-house:** puesto, dedicación **Full Time / Part Time / Por horas**, horas y período cuando corresponda, modalidad remoto/presencial/híbrido, ubicación si no es remoto, días presenciales si es híbrido, días de trabajo, horario o por definir, zona horaria, responsabilidades, fecha de inicio y remuneración opcionales.
- **Por proyecto:** nombre y área del proyecto, problema, resultado, entregables opcionales, fechas o entrega por definir, presupuesto opcional, modalidad, ubicación si corresponde y referencia opcional.
- **Común:** «¿Querés que me comunique con vos?» → «Sí, contactame.» o «No, nosotros te devolvemos la llamada.». Para la primera respuesta aparece medio preferido (WhatsApp / Llamada / E-mail) y horario opcional; teléfono requerido si se solicita llamada o WhatsApp. «Observaciones adicionales» opcional, máximo 1.000 caracteres.
- **Persistencia:** nuevas solicitudes con `action:"lead_v2"`, `intake_version=2`, `intake_data` JSONB para las condiciones, `contact_preference`, `contact_method`, `contact_time`, `observations`. Las solicitudes previas siguen accesibles.
- **Gestión:** panel de administración incluye detalles estructurados y estados «Nueva → Contactada → En evaluación → Cerrada». Columnas y restricción de estados actualizadas sin eliminar datos.
- **Privacidad:** nunca se envían datos de las solicitudes al portal de reclutadores; solo son legibles desde el panel autorizado. La preferencia «la empresa nos devuelve la llamada» implica **no iniciar contacto proactivo**.
- **Estado:** frontend, base de datos y Edge Function v5 modificados; verificación de sintaxis, IDs, permisos y esquema. Prueba real de envío desde navegador pendiente, sin crear solicitudes ficticias en producción.

## Formularios rápidos v3 — 23/11/2026
- **Decisión:** optimizar conversión antes de calificación exhaustiva; no solicitar un brief ni condiciones laborales completas para captar el primer interés.
- **2 buyer persona / 2 formularios:** `in_house` (reclutadores) y `proyecto` (empresarios o responsables de área). Una sola pantalla, sin pasos de avance.
- **In-house:** empresa, vacante, dedicación por selección múltiple (Full Time / Part Time / Por horas), modalidad por selección múltiple (Remoto / Híbrido / Presencial), correo y preferencia de contacto. El detalle de remuneración, ubicación y horarios pasa a la conversación posterior.
- **Proyecto:** empresa, necesidad por selección múltiple (más clientes / marketing y contenido / automatización e IA / solución digital / otro), urgencia por selección múltiple (urgente / este mes / más adelante / a definir), correo y preferencia de contacto. No se pide brief ni presupuesto al inicio.
- **Contacto:** «Sí, contactame.» o «No, nosotros te devolvemos la llamada.»; si pide contacto, el e-mail está seleccionado por defecto y puede cambiar a WhatsApp o llamada (piden teléfono solo entonces).
- **Opcionales ocultos en `<details>`:** observaciones (hasta 1000 caracteres) y nombre del contacto. La empresa se precarga si el RUC está asociado a CV registrados.
- **Persistencia:** nueva acción `lead_v3` en Edge Function v6, `intake_version=3` y `intake_data` JSONB con campos estructurados. Se preservan `lead_v2` y `lead` para cachés y registros históricos. El administrador muestra v2 y v3.
- **Acceso:** ofrecer las dos oportunidades en `/empresa/` tanto con CV activos como vencidos o sin CV; no tocar el lector PDF ni los archivos del bucket.
- **Validación estática:** sintaxis y IDs, contrato cliente/Edge, estructura SQL; prueba de envío extremo a extremo sin crear leads ficticios pendiente.

## Riesgos aceptados
- RUC es un identificador público, no una autenticación: cualquiera que lo conozca puede consultar las vacantes y descargar CV vigentes. Decisión deliberada para experiencia sin fricción.
- Los CV permanecen en Storage privado y se generan URLs firmadas solo en el backend; no garantiza identidad del reclutador.
- Sin notificaciones automáticas por correo; las solicitudes se visualizan en administración.

## Estado de implementación
- EJECUTADO: esquema, columna de estado, Edge Function v4, portal individual `/empresa/`, enlace desde el panel, controles de vacante/estado, RLS y bucket privado.
- VERIFICADO: código JS sintácticamente válido; backend activo y sincronizado con GitHub; esquema actualizado.
- PENDIENTE DE VERIFICAR: render en navegador del portal con un CV real y, luego, con dos CV vigentes del mismo RUC; descarga y expiración en móvil.
- PENDIENTE DE REVISIÓN (separado de este cambio): el auditor de seguridad de Supabase avisa sobre función `public.rls_auto_enable()` ejecutable por roles públicos y protección contra contraseñas filtradas desactivada. No se modificó automáticamente ese componente ajeno al flujo.
