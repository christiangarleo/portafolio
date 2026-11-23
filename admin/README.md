# CV personalizados — guía operativa

## Objetivo
El lector de https://christianarleo.com/portafolio/ puede solicitar un CV personalizado usando un RUC de 11 dígitos. Sin CV principal activo y vigente, se habilitan formularios **in-house**, **proyecto** y **solicitud de CV**.

## Fuente de verdad / componentes
- Frontend lector: `portafolio/index.html`, `portafolio/cv-portal.js`.
- Visor PDF público: `portafolio/lector-v10.js` (conserva el portafolio público).
- Panel: `admin/index.html`, `admin/panel.js`; URL: https://christianarleo.com/admin/
- Supabase: proyecto `gprhevdotoykofrxbufv`, función `portfolio-cv-portal`, tablas `portfolio_cv_admins`, `portfolio_cv_documents`, `portfolio_cv_leads`.
- Bucket privado: `cv-personalizados`. No modificar el bucket público `portafolio`.

## Activación inicial del panel (una sola vez)
1. Abrir https://christianarleo.com/admin/ y seleccionar **Crear mi cuenta** con el correo de administración que controles. No compartir contraseñas.
2. Confirmar el correo de Supabase Auth. Si la redirección del mensaje va a otro sitio, volver manualmente a https://christianarleo.com/admin/.
3. En Supabase Dashboard, verificar el usuario en **Authentication > Users**. En **SQL Editor**, ejecutar, usando el correo registrado (sin copiar contraseñas):

```sql
insert into public.portfolio_cv_admins (user_id)
select id from auth.users
where lower(email) = lower('hola@christianarleo.com') and email_confirmed_at is not null
on conflict (user_id) do nothing;
```

4. En el panel privado, pulsar **Comprobar acceso**. Si registraste otro correo, reemplazar la dirección del SQL por tu dirección verificada.

## Cargar un CV
- Ingresar empresa, RUC (11 dígitos), puesto, archivo PDF (máximo 30 MB), y opcionalmente fecha de vencimiento.
- Si seleccionás **Principal**, el panel desmarca el anterior principal del mismo RUC. Solo el principal debe usarse para una entrega automática.
- Los archivos tienen rutas únicas (sin `(1)`). Cargar otra versión y marcar Principal no sobrescribe físicamente versiones anteriores; desactivar o eliminar las anteriores si es necesario.
- Podés desactivar un CV y revocar accesos futuros. Los enlaces firmados ya emitidos siguen válidos hasta 90 segundos.

## Comportamiento público
- Descargar > Portafolio PDF: descarga pública ya existente.
- Descargar > CV personalizado: ingresar RUC > función `portfolio-cv-portal`.
- CV disponible: enlace firmado de descarga (90 segundos).
- CV no disponible/vencido: elegir in-house, proyecto o solicitud de CV; el formulario se guarda en `portfolio_cv_leads` y puede revisarse en el panel.

## Alcance / riesgos
- **El RUC no autentica a un reclutador**: cualquiera que lo conozca puede descargar el CV durante su vigencia. Es una decisión expresa del proyecto.
- La cuenta administradora sí está protegida por Auth + membresía + RLS. No usar nunca una clave secreta de Supabase en el navegador.
- No hay notificaciones automáticas por correo en esta versión: las solicitudes se leen en el panel privado.
- Si no hay usuarios administradores o archivos cargados, el sistema responde con la ruta de solicitud. No se debe crear información ficticia de prueba en producción.
- El frontend y las migraciones fueron revisados estáticamente; prueba E2E con usuario real y PDF real pendiente.

## Estado
- EJECUTADO: schema Supabase, RLS, bucket privado, Edge Function pública, frontend, panel de administración.
- PENDIENTE: registrar y aprobar usuario administrador; subir CV real; verificar descarga, vencimiento y formularios desde dispositivo real.
