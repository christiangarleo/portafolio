# CV personalizados — guía operativa vigente

## Objetivo
Desde https://christianarleo.com/portafolio/ una empresa identifica CV por RUC (11 dígitos), sin códigos adicionales.
- **0 CV vigentes:** ofrecer solicitud de CV / in-house / proyecto.
- **1 CV vigente:** descarga automática de CV a través de un enlace temporal.
- **2 o más CV vigentes:** mostrar un panel con las vacantes, CV vigentes y vencidos de ese RUC. Cada CV vigente se descarga individualmente. Los vencidos no generan enlace.
- No mostrar el **estado de postulación** del registro interno al reclutador.

## Componentes y fuente de verdad
- Frontend público: `portafolio/index.html` y `portafolio/cv-portal.js`.
- Lector PDF público: `portafolio/lector-v10.js` (no modificar al evolucionar los CV).
- Administración privada: `admin/index.html` y `admin/panel.js`, https://christianarleo.com/admin/.
- Supabase: proyecto `gprhevdotoykofrxbufv`, Edge Function `portfolio-cv-portal`; fuente versionada de función en `supabase/functions/portfolio-cv-portal/index.ts`.
- Tablas: `public.portfolio_cv_admins`, `public.portfolio_cv_documents`, `public.portfolio_cv_leads`.
- Bucket privado `cv-personalizados` (mantener aparte de `portafolio`, el bucket público).
- Campo nuevo ejecutado en producción: `public.portfolio_cv_documents.application_status` (por defecto `preparado`; permitidos `preparado`, `postulado`, `en_proceso`, `finalizado`). Es **solo interno**.
- `role_name` representa la **vacante**, editable posteriormente con «Editar vacante».
- `is_main` solo prioriza orden del selector. NO excluye otros CV del mismo RUC cuando hay varios vigentes.

## Administración
1. Acceder con la cuenta verificada y autorizada en Supabase Auth; la autorización vive en `portfolio_cv_admins` con RLS.
2. Subir archivo PDF (máximo 30 MB), empresa, RUC, puesto, fecha de vencimiento opcional y estado interno.
3. Ver/editar postulación en el listado: cambiar estado, editar nombre de vacante, seleccionar principal, activar/desactivar y eliminar.
4. Si un RUC tiene varios CV, no borrar los alternativos: se muestran por vacante; los vencidos aparecen como «No disponible».
5. Archivo recién subido: ruta única con UUID, para evitar colisiones de nombres y versiones.
6. Revocar el acceso desactivando el registro; los enlaces de descarga generados tienen un TTL máximo de 90 segundos.

## Contratos de la función
- `POST {action:"resolve",ruc:"<11 dígitos>"}`:
  - `{status:"not_found"}` si no hay CV vigentes;
  - `{status:"ready",url,company,position}` si hay exactamente uno;
  - `{status:"multiple",company,items:[{id,position,expires_at,available}]}` si hay más de uno.
- `POST {action:"download",ruc,id}`: valida RUC, CV activo, vencimiento y genera un enlace firmado de 90s.
- `POST {action:"lead",...}`: registra solicitud comercial en `portfolio_cv_leads`.
- No devolver rutas privadas de Storage, estados internos ni claves secretas en el frontend.

## Riesgos aceptados
- RUC es un identificador público, no una autenticación: cualquiera que lo conozca puede consultar las vacantes y descargar CV vigentes. Decisión deliberada para experiencia sin fricción.
- Los CV permanecen en Storage privado y se generan URLs firmadas solo en el backend; no garantiza identidad del reclutador.
- Sin notificaciones automáticas por correo; las solicitudes se visualizan en administración.

## Estado de implementación
- EJECUTADO: esquema, columna de estado, Edge Function v3, frontend selector, controles de vacante y estado, RLS y bucket privado.
- VERIFICADO: código JS sintácticamente válido; backend activo y sincronizado con GitHub; esquema actualizado.
- PENDIENTE DE VERIFICAR: flujo extremo a extremo para **2 CV vigentes del mismo RUC** (actualmente hay uno cargado); prueba de vencimiento y descarga en móvil.
- PENDIENTE DE REVISIÓN (separado de este cambio): el auditor de seguridad de Supabase avisa sobre función `public.rls_auto_enable()` ejecutable por roles públicos y protección contra contraseñas filtradas desactivada. No se modificó automáticamente ese componente ajeno al flujo.
