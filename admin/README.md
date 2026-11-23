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

## Riesgos aceptados
- RUC es un identificador público, no una autenticación: cualquiera que lo conozca puede consultar las vacantes y descargar CV vigentes. Decisión deliberada para experiencia sin fricción.
- Los CV permanecen en Storage privado y se generan URLs firmadas solo en el backend; no garantiza identidad del reclutador.
- Sin notificaciones automáticas por correo; las solicitudes se visualizan en administración.

## Estado de implementación
- EJECUTADO: esquema, columna de estado, Edge Function v4, portal individual `/empresa/`, enlace desde el panel, controles de vacante/estado, RLS y bucket privado.
- VERIFICADO: código JS sintácticamente válido; backend activo y sincronizado con GitHub; esquema actualizado.
- PENDIENTE DE VERIFICAR: render en navegador del portal con un CV real y, luego, con dos CV vigentes del mismo RUC; descarga y expiración en móvil.
- PENDIENTE DE REVISIÓN (separado de este cambio): el auditor de seguridad de Supabase avisa sobre función `public.rls_auto_enable()` ejecutable por roles públicos y protección contra contraseñas filtradas desactivada. No se modificó automáticamente ese componente ajeno al flujo.
