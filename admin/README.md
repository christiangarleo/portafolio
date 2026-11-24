# CV personalizados — guía operativa vigente

## Objetivo
Desde https://christianarleo.com/portafolio/ el reclutador ingresa el **identificador de empresa (de 1 a 64 caracteres, sin exigir RUC de 11 dígitos)** y abre **siempre una página dedicada**: https://christianarleo.com/empresa/?ruc=<IDENTIFICADOR>. El parámetro `ruc` es un nombre técnico histórico, no exige número peruano ni autentica al reclutador.
- **0 CV registrados/activos:** la página ofrece solo «Contratación In-house» o «Contratación por proyecto».
- **1 o más CV asociados al identificador:** se muestra el portal de la empresa con todas las vacantes vinculadas a CV activos, incluso cuando hay uno solo. Cada tarjeta ofrece la descarga bajo demanda de su CV vigente.
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
- `is_main` solo prioriza orden del portal. NO excluye otros CV de la misma empresa. No se usa para descargar automáticamente.

## Administración
1. Acceder con la cuenta verificada y autorizada en Supabase Auth; la autorización vive en `portfolio_cv_admins` con RLS.
2. Subir archivo PDF (máximo 30 MB), empresa, identificador global, puesto, fecha de vencimiento opcional y estado interno.
3. Ver/editar postulación en el listado: cambiar estado, editar nombre de vacante, seleccionar principal, activar/desactivar y eliminar.
4. Si un identificador tiene varios CV, no borrar los alternativos: se muestran por vacante; los vencidos aparecen como «No disponible».
5. Archivo recién subido: ruta única con UUID, para evitar colisiones de nombres y versiones.
6. Revocar el acceso desactivando el registro; los enlaces de descarga generados tienen un TTL máximo de 90 segundos.

## Contratos de la función
- `POST {action:"resolve",ruc:"<identificador global de hasta 64 caracteres>"}`:
  - `{status:"not_found"}` si no existen CV activos registrados;
  - `{status:"company",company,items:[{id,position,expires_at,available}]}` si existe uno o más CV activos, incluidos los vencidos.
- `POST {action:"download",ruc,id}`: valida que el CV pertenezca al identificador empresarial, esté activo y vigente, y genera enlace firmado de 90 segundos.
- `POST {action:"lead_v3",...}`: registra la propuesta vigente en `portfolio_cv_leads` (las acciones `lead_v2` y `lead` se preservan para compatibilidad).
- No se devuelve URL firmada al consultar el identificador, **solo al pulsar Descargar en la tarjeta elegida**.
- No devolver rutas privadas de Storage, estados internos ni claves secretas al frontend.

## Formularios comerciales v2 (histórico; reemplazados por v3)
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

## Apariencia compartida — 23/11/2026
- **EJECUTADO:** selector de apariencia (Automático, Claro, Oscuro) en `/`, `/portafolio/`, `/empresa/` y `/admin/`.
- Fuente de estilos y lógica única: `theme/theme.css` y `theme/theme.js`. Las páginas tienen un script mínimo en `<head>` para aplicar la preferencia antes de cargar la interfaz (evitar destello).
- Preferencia: `localStorage["cga-appearance"]` solo guarda `system`, `light` o `dark`; sin datos personales. Automático sigue `prefers-color-scheme` del dispositivo.
- El modo oscuro afecta únicamente **interfaz, formularios, menús, controles, barras y fondo del lector**, pero NO modifica los píxeles de los documentos PDF (canvas, página y visor nativo).
- **VERIFICADO:** enlaces e inicialización en las cuatro páginas, sintaxis de JavaScript y balance de reglas CSS; queda pendiente revisión visual manual en navegadores/móvil tras publicación en GitHub Pages.

## Sitio bilingüe ES/EN — 23/11/2026
- **EN vigente por defecto:** `/portafolio/?lang=en` y `/empresa/?ruc=<RUC>&lang=en`. La raíz `/` es una pantalla de elección permanente con «🇬🇧 English» primero y «🇪🇸 Español» después.
- **Selección persistida:** `localStorage["cga-site-language"]` guarda `en` o `es`. URL `lang=` tiene prioridad sobre preferencia previa, que a su vez prevalece sobre el inglés predeterminado. Existe selector de idioma en los encabezados públicos.
- **Fuente de traducciones:** `lang/i18n.js`. Solo se traduce interfaz, validaciones y mensajes; nunca se traduce automáticamente información que ingrese una empresa (como nombre de vacantes).
- **Manifiesto PDF por idioma:** `lang/portfolio-files.js`. Español usa `portafolio/Christian_Arleo_Portafolio.pdf`; inglés usa exclusivamente `portafolio/Christian_Arleo_Portfolio_EN.pdf`. **No usar el español como reemplazo del inglés.**
- **Estado de archivos verificado el 23/11/2026:** el PDF en español existe (aprox. 22,7 MB). El PDF inglés **NO está publicado**. La página inglesa lo indica claramente y bloquea su descarga hasta poder recuperar un archivo PDF real. Al subir el archivo en la ruta reservada, el lector inglés comenzará a cargarlo automáticamente.
- **Fuente de subida autorizada:** `/admin/`, sección «Portafolios públicos · Español / English». Dos formularios independientes: tarjeta Español con botón «Reemplazar PDF en español» y tarjeta English con «Publicar/Reemplazar PDF en inglés». No se utiliza un selector desplegable para evitar confusión de idioma. El formulario valida la firma PDF y un máximo de 45 MB; requiere cuenta autorizada y confirmación antes de reemplazar un documento publicado.
- **Permisos:** tres políticas RLS de `storage.objects` para SELECT / INSERT / UPDATE solamente por administradores y solamente para los dos nombres exactos. El bucket sigue público para visualizar los PDF, no para subirlos anónimamente.
- **Navegación de páginas:** los enlaces comparten `?lang=`; cambiar de idioma elimina `?pagina=` para no llevar la misma página numérica a un PDF con distribución diferente. Índice y marcadores del español siguen configurados (3,4,5,6,23); los marcadores de inglés permanecen ocultos hasta revisar su PDF definitivo. El PDF, su conteo real de páginas, el visor y su descarga se tratan de forma independiente.
- **No se altera:** el lector de CV privados por RUC, la base de propuestas, la autenticación ni el CSS de la apariencia. En administración se mantiene español como idioma interno.
- **VERIFICADO en código:** rutas por idioma, fuente única del manifiesto, sintaxis JS, traducciones y RLS. **PENDIENTE de verificación E2E:** carga del PDF inglés real y comprobación de sus secciones, funcionamiento en móvil y revisión visual luego del despliegue.

## CRM de propuestas recibidas — 24/11/2026
- **Propósito:** gestionar la solicitud recibida como oportunidad sin generar otros agentes ni sistemas paralelos.
- **Fuente operativa:** `admin/solicitudes.js` (importado desde `admin/panel.js`); la sección «Oportunidades y propuestas» en `admin/index.html` reemplaza la tabla antigua sin borrar registros existentes.
- **Estados de decisión:** `pendiente → avanzar / rechazada`, con opción «Reconsiderar». Al avanzar se actualiza el seguimiento a `en_evaluacion`; al rechazar a `cerrado`. La nota de rechazo se guarda internamente.
- **Bandejas:** Por decidir, En seguimiento, Rechazadas, Todas. Cada propuesta conserva los campos recibidos de formularios v1, v2 y v3.
- **CV del interesado:** permite seleccionar un CV activo/vigente del mismo RUC o subir uno nuevo (PDF máximo 30 MB) al bucket privado `cv-personalizados`. Relación explícita `portfolio_cv_leads.cv_document_id` (FK a `portfolio_cv_documents`). No copia el documento al correo; proporciona descarga administrativa para adjuntar a mano y enlace al portal de la empresa con `?ruc=&cv=<UUID>&lang=`.
- **Contacto:** prepara texto editable en el idioma original de la propuesta; «Abrir correo» invoca `mailto:`, «Abrir en Gmail» crea un borrador en el navegador y «Abrir WhatsApp» abre `wa.me` con el texto preparado. **Ninguna acción envía mensajes automáticamente ni adjunta binarios al correo.** El administrador debe pulsar enviar en el servicio externo y luego confirmar manualmente el envío; solo en ese momento se registra `email_sent_at` / `whatsapp_sent_at`.
- **Respeto de preferencia:** si el interesado eligió `empresa_contacta` («nosotros te devolvemos la llamada»), los botones de contacto quedan bloqueados hasta que el administrador registre explícitamente una autorización posterior realmente obtenida (`contact_override_at`).
- **Reunión:** propuesta de fecha/hora local, modalidad, enlace y notas en `meeting_at`, `meeting_mode`, `meeting_link`, `meeting_notes`; queda incorporada a los textos de correo/WhatsApp al guardar. No crea un evento de Calendar ni confirma una reserva.
- **Historial auditable:** `public.portfolio_cv_lead_activities` con RLS de administración, solo lectura/inserción para usuarios autenticados autorizados; `anon` no tiene permisos de tabla. Registra decisiones, CV, borradores abiertos, confirmaciones manuales, cambios de etapa y propuestas de reunión; preserva datos existentes.
- **Idioma:** `portfolio_cv_leads.language` en `es/en`, default `es` para registros anteriores. El endpoint `lead_v3` guarda el idioma real del visitante. La comunicación y el enlace al portal respetan esa preferencia.
- **Verificaciones:** columnas/constraints/roles/estado de la función y código sintácticamente validado; prueba de interacción E2E real desde el navegador pendiente. No crear propuestas artificiales de prueba en producción.
- **Pendiente de una integración opcional futura:** un proveedor autorizado de envío SMTP/API y WhatsApp Business permitiría despacho desde el panel con adjuntos reales; no está implementado ni deben insinuarse envíos automáticos.

## CRM compacto — 24/11/2026 (vigente)
- **Necesidad:** reducir la gestión a una pantalla corta; mantener decisión Avanzar/Rechazar como filtro obligatorio de acciones.
- **CV:** el selector de CV vigentes del mismo RUC se guarda al elegir, sin botón «Asociar». Botón «+ Subir PDF» abre el selector de archivos y, al seleccionar un PDF válido de hasta 30 MB, lo sube y lo asocia automáticamente. El nombre del puesto se toma del asunto/vacante de la solicitud. El CV sigue accesible desde el portal por RUC, con enlace directo a la tarjeta correspondiente.
- **Respuesta:** botones principales «Abrir correo (Zoho)» y «WhatsApp», sin textareas largas a la vista; «Ver o editar el mensaje» queda desplegable. El correo incluye enlace al CV y puede incluir propuesta de reunión.
- **Correo:** la implementación usa `mailto:` (aplicación de correo predeterminada; Zoho Mail solo si está configurado como controlador de correo en navegador/sistema). **No se envía directamente desde el sitio y no adjunta PDF automáticamente**. Se conserva «Descargar PDF para adjuntar». Enviar de verdad con Zoho Mail API requerirá autorizar una integración de Zoho Mail; tener el dominio alojado en Zoho no concede permisos de API.
- **WhatsApp:** se abre `https://wa.me/` con mensaje listo y enlace al CV. Si falta número, «+ Agregar teléfono para WhatsApp» lo permite guardar desde la solicitud. No se marca enviado sin la confirmación manual del administrador.
- **Reunión:** solo se despliega al elegir «+ Proponer reunión»; guarda fecha/hora, modalidad y enlace opcional. No crea invitación de calendario.
- **Seguimiento e historial:** permanecen disponibles bajo desplegables. No se reescribieron solicitudes ya existentes ni se automatizaron acciones salientes.
- **Privacidad:** si la empresa eligió «Nosotros te devolvemos la llamada», se mantiene el bloqueo de contacto salvo autorización posterior real.
- **Estado:** código actualizado y validado estáticamente; pendiente prueba de interfaz y correo configurado en navegador con la cuenta Zoho del administrador.

## Identificadores internacionales de empresa — 24/11/2026
- **Vigente:** la entrada pública, el portal, el CRM y la administración usan «Identificador de empresa», con ejemplos RUC, RFC, NIT, RUT, CUIT, CNPJ, EIN, VAT ID, NIF/CIF y ABN; el ID **no tiene longitud fija de 11 dígitos**.
- **Compatibilidad sin duplicación:** la columna histórica `ruc` de `public.portfolio_cv_documents` y `public.portfolio_cv_leads` sigue siendo el **campo canónico** para este identificador, ampliado de `varchar(11)` a `varchar(64)`. No se creó una columna paralela. Se relajaron los CHECK para aceptar valores no vacíos de hasta 64 caracteres (o NULL para solicitudes antiguas). Los RUC peruanos ya existentes no se modificaron.
- **Normalización consistente:** navegador, administración y Edge Function utilizan el identificador sin espacios externos, espacios internos repetidos reducidos a uno, y mayúsculas. Se admiten letras (también Unicode), números y separadores comunes: espacio, punto, guion, guion bajo, barra, numeral, ampersand y paréntesis.
- **Backend:** `portfolio-cv-portal` (resolve/download/lead_v3/lead_v2/lead legacy) consulta y valida por identificador normalizado. Sigue validando el UUID y la vigencia del CV. El campo JSON del protocolo continúa llamándose `ruc` por compatibilidad técnica; su contenido es **identificador empresarial general**, no necesariamente un RUC.
- **Storage:** nuevas subidas del panel y del CRM usan rutas aleatorias `companies/<UUID>.pdf` para evitar convertir caracteres como `/` del identificador en segmentos de ruta. Los PDF anteriores y sus rutas continúan válidos.
- **Seguridad aceptada:** los identificadores fiscales/de registro no son contraseñas. El acceso por identificador no acredita ser parte de la empresa, según la decisión de experiencia sin fricción; no se exponen estados internos de postulación.
- **VERIFICADO:** migración de los dos campos y CHECK, despliegue de Edge Function, enlace correcto cliente/servidor y sintaxis JS. **PENDIENTE:** pruebas E2E en navegador con una empresa extranjera real y descarga de CV correspondiente; no se crearon registros de prueba falsos.

## Riesgos aceptados
- RUC es un identificador público, no una autenticación: cualquiera que lo conozca puede consultar las vacantes y descargar CV vigentes. Decisión deliberada para experiencia sin fricción.
- Los CV permanecen en Storage privado y se generan URLs firmadas solo en el backend; no garantiza identidad del reclutador.
- Sin notificaciones automáticas por correo; las solicitudes se visualizan en administración.

## Estado de implementación
- EJECUTADO: esquema, columna de estado, Edge Function v6, portal individual `/empresa/`, enlace desde el panel, controles de vacante/estado, RLS y bucket privado.
- VERIFICADO: código JS sintácticamente válido; backend activo y sincronizado con GitHub; esquema actualizado.
- PENDIENTE DE VERIFICAR: prueba end-to-end de los formularios rápidos v3 y de descargas en móvil; no se generan solicitudes ficticias en producción.
- PENDIENTE DE REVISIÓN (separado de este cambio): el auditor de seguridad de Supabase avisa sobre función `public.rls_auto_enable()` ejecutable por roles públicos y protección contra contraseñas filtradas desactivada. No se modificó automáticamente ese componente ajeno al flujo.


## Ajustes UX del 24/11/2026 — correo, horarios, portal internacional y PDF inglés

- **CRM / solicitud aceptada:** editar el asunto y el mensaje **antes** de abrir el proveedor. Botones explícitos **Zoho Mail**, **Gmail** y **WhatsApp**. Zoho emplea `mailto:` y depende del controlador predeterminado de correo; Gmail abre su página de composición con asunto/cuerpo; ninguno envía automáticamente ni adjunta PDF sin intervención. La descarga del PDF desde el paso CV sigue disponible.
- **Confirmación:** los controles de envío son switches accesibles con `role="switch"`, apagados inicialmente y mostrados tras abrir el borrador; al activarlos requieren confirmación de que el envío ocurrió realmente. La confirmación y su reversión se guardan en `email_sent_at` / `whatsapp_sent_at` y el historial de `portfolio_cv_lead_activities`. Nunca afirmar envío solo por abrir el proveedor.
- **Reunión:** fecha + selector de hora 00–23 y minutos **00, 05, 10, …, 55**. Se normaliza a fecha local del navegador antes de guardar el ISO UTC existente en `meeting_at`.
- **Menú de descarga:** «Ver Curriculum Vitae (CV)» reemplaza «Acceder a CV por empresa». Se conserva el formulario por identificador, sin 11 dígitos obligatorios.
- **Empresa sin CV:** solo tras un resultado `not_found` del servicio, se abre un diálogo con **Continuar / Modificar identificador de empresa / Volver al portafolio**. No se afirma que nunca existió una solicitud: solo que no hay CV disponible. La edición acepta ID internacional de hasta 64 caracteres. Regreso y cambios incluyen `?lang=en|es`, y el selector de idioma del encabezado permanece visible.
- **PDF inglés:** antes `sections:null` ocultaba los enlaces. El lector vuelve a mostrar las cinco opciones y detecta destinos desde los marcadores y títulos de **su propio PDF**. Como respaldo temporal para la edición inglesa actual de 55 páginas, utiliza un mapa provisional, que se reemplaza por los títulos localizados en el archivo. **NO_VERIFICADO**: destino exacto de todas las secciones hasta revisar el PDF inglés real manualmente.
- **VERIFICADO:** rutas, validación estática del JavaScript, selectores de minutos, orden del editor y canales, traducciones i18n y caché del repositorio.
- **NO_VERIFICADO:** ejecución E2E en navegador con la cuenta de Zoho local, envío efectivo desde Gmail/WhatsApp, paginación inglesa definitiva y compatibilidad de calendario/diálogo en diferentes navegadores.
