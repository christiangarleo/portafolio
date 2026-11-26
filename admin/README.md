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

## Ajuste de proveedores de correo y switches — 24/11/2026
- **Zoho Mail:** el botón ya no invoca `mailto:` (que en el navegador del titular abría Gmail). Abre explícitamente `https://mail.zoho.com/zm/#compose` en otra pestaña o ventana. Como no hay OAuth/API de Zoho autorizada, no se puede garantizar que el destinatario/asunto/cuerpo se precarguen: el CRM ofrece «Copiar destinatario», «Copiar asunto» y «Copiar mensaje», con Clipboard API y alternativa manual.
- **Gmail:** abre `https://mail.google.com/mail/?view=cm&fs=1` en otra pestaña/ventana con destinatario, asunto y cuerpo codificados en la URL.
- **WhatsApp:** abre `https://wa.me/` en otra pestaña/ventana con texto precargado. Si falta número, el botón de apertura queda desactivado y se ofrece agregarlo, pero **el switch manual de confirmación siempre está visible**. El titular puede registrar un mensaje enviado fuera del panel.
- **Confirmaciones:** correo y WhatsApp tienen switches independientes siempre visibles. Abrir una aplicación no los activa; cualquier cambio exige confirmación explícita y queda en `portfolio_cv_leads.email_sent_at` / `whatsapp_sent_at` y el historial.
- **Estado:** EJECUTADO: código y assets actualizados; VERIFICADO: sintaxis JS, referencias de cliente y CSS; NO_VERIFICADO: Zoho compose real, personalización de apertura por navegador, envío auténtico y pruebas E2E.

## Bandeja compacta de solicitudes — 24/11/2026
- **Problema UX:** cada propuesta construía una tarjeta extensa con CV, reunión, editor de mensajes, canales, switches e historial. Con múltiples registros se volvía imposible escanear la bandeja.
- **Decisión vigente:** patrón **maestro–detalle** dentro de la misma sección de administración. La columna izquierda lista solicitudes compactas (empresa, vacante, fecha, estado y señales de CV/correo/WhatsApp) y el panel derecho muestra **solo la solicitud seleccionada** con todos los controles actuales.
- **Escalabilidad de interfaz:** los filtros «Por decidir», «En seguimiento», «Rechazadas», «Todas» y el buscador se conservan. Orden descendente por fecha. Paginación de **15 solicitudes por pantalla** sobre las 200 últimas cargadas del backend; los datos no se duplican ni se modifican.
- **Móvil ≤820px:** el listado ocupa toda la pantalla. Seleccionar una fila abre la ficha en una vista separada con botón «Volver a solicitudes». En escritorio, el listado y detalle tienen scroll independiente y uno solo conserva el foco visual.
- **Datos y seguridad:** sin nuevas tablas, endpoints ni roles. Se reutilizan Supabase Auth/RLS existentes, la asociación de CV, los borradores Zoho/Gmail/WhatsApp, los switches de confirmación y el historial. Solo cambia la presentación.
- **EJECUTADO:** `admin/solicitudes.js`, `theme/modern.css`, versión de caché en `admin/panel.js` y `admin/index.html`.
- **VERIFICADO:** sintaxis JS, enlaces de recursos y presencia de controles. **NO_VERIFICADO:** QA visual/teclado/táctil y navegación E2E en navegador con muchas solicitudes; las consultas aún están limitadas a las 200 últimas hasta implementar paginación de servidor.

## Ajuste UX puntual — 24/11/2026: envío, identificadores y acentos
- **Respuesta en back office:** desaparece el panel extenso de ayuda de Zoho y su explicación redundante. Bajo el mensaje editable se muestran los tres botones compactos «Copiar destinatario», «Copiar asunto», «Copiar mensaje» y los canales Zoho Mail, Gmail y WhatsApp. Zoho sigue abriendo su bandeja, no envía ni autocompleta sin una API autorizada.
- **Switches:** activar/desactivar «Ya envié el correo» y «Ya envié por WhatsApp» guarda de inmediato `email_sent_at` y `whatsapp_sent_at`, sin `window.confirm`. Son declaraciones manuales reversibles del único administrador; abrir una aplicación no activa el switch. Se preservan RLS y actividad histórica.
- **Empresa sin CV:** cada modificación de identificador consulta nuevamente la Edge Function antes de decidir. Si sigue sin documentos, se reinicia el mismo diálogo con el identificador actualizado, sin permitir ingreso silencioso. Si se encuentra CV, navega al portal correspondiente. Solo «Continuar» cierra el aviso sin documentos. Se preserva `lang=es/en`.
- **Acentos exclusivamente del formulario de contratación en `/empresa/`:** amarillo oficial `#F6DB0E` en chips/radios seleccionados y bordes de elección; rosa oficial `#E5007D` en el botón principal de propuesta. La paleta canónica permanece intacta en otros módulos. Texto negro sobre amarillo y texto negro grande sobre rosa para contraste.
- **Estados:** EJECUTADO: cambios en `admin/solicitudes.js`, `empresa/empresa.js`, `theme/modern.css` y versiones de caché en ambos HTML. VERIFICADO: sintaxis y referencias estáticas. NO_VERIFICADO: pruebas E2E de UI y de Zoho reales.

## Rechazo por correo: corrección de mailto heredado — 24/11/2026
- **Error:** «Responder rechazo por correo» utilizaba la función heredada `mailto()`, aunque los mensajes de seguimiento ya tenían Zoho/Gmail separados. El navegador tenía Gmail configurado como controlador `mailto:`, de modo que mostraba el aviso «Se abrió un borrador ... Zoho, si está configurado» y no llevaba a Zoho Mail.
- **Solución ejecutada:** eliminar `mailto()` del CRM. «Preparar correo de rechazo» despliega un editor con «Para», asunto y mensaje del idioma de la solicitud; controles copiar destinatario/asunto/mensaje; enlaces diferenciados **Zoho Mail** (`https://mail.zoho.com/zm/#mail/folder/inbox`) y **Gmail** (`https://mail.google.com/mail/?view=cm&fs=1...`) en pestañas nuevas. Ninguno envía automáticamente ni exige cambiar el handler predeterminado.
- **Registro exacto:** switch «Ya envié el rechazo» guardado en historial como `rechazo_correo_confirmado` o `rechazo_correo_confirmacion_retirada`, separado de `email_sent_at` para no confundir una respuesta de seguimiento anterior con el rechazo. La base mantiene su índice y políticas RLS de un único administrador, sin nuevos campos/tablas. El estado se deriva del último evento del historial.
- **Reparación adicional:** al avanzar en una solicitud pendiente, una referencia antigua `expanded.add()` apuntaba a un conjunto retirado por la bandeja compacta; se elimina para evitar error de JavaScript.
- **Verificación:** sintaxis y versiones de JS/CSS revisadas; esquema de actividades confirmado con `actor_user_id default auth.uid()`, tipo de evento libre entre 3–60 caracteres, `details` JSON objeto y RLS INSERT de administrador. **Pendiente:** QA de pestañas Zoho/Gmail y entrega real desde cuenta de correo autorizada (sin OAuth no existe envío directo).


## Identificador visible en CRM y acentos por tema — 24/11/2026
- **CRM privado:** `admin/solicitudes.js` ahora muestra `lead.ruc` bajo el rótulo neutral «Identificador de empresa» en la ficha detallada (con acción «Copiar») y bajo «ID empresa» en cada fila compacta. No limita a RUC peruano, no altera formularios, RLS ni columnas.
- **Formulario público (`empresa/#emptySection`):** seleccionado en **rosa `#E5007D`** en ambos temas. Modo claro: CTA «Enviar invitación» y acento superior en **cian `#09B3DC`**; modo oscuro: CTA y acento superior en **amarillo `#F6DB0E`**. Textos de las opciones usan la tinta del tema y el CTA usa negro oficial para conservar legibilidad. Solo se cambiaron reglas visuales del formulario, no la paleta canónica del portafolio.
- **Fuente:** `theme/modern.css`, con `--company-select-accent`, `--company-submit-accent` y tokens oficiales preexistentes. Enlace CSS cacheado con versión nueva en `admin/index.html` y `empresa/index.html`. El componente CRM también tiene versión nueva en `admin/panel.js` y `admin/index.html`.
- **EJECUTADO:** archivos versionados. **VERIFICADO:** referencias estáticas, sintaxis JS y reglas CSS. **NO_VERIFICADO:** QA visual real en navegadores móviles/desktop con datos reales y los dos temas.

## Corrección de acentos del formulario público — 24/11/2026
- **Decisión del titular:** sustituye exclusivamente la asignación de acentos del formulario descrita en la sección anterior: tema claro = amarillo oficial `#F6DB0E`; tema oscuro = cian oficial `#09B3DC`. Se conservan selección/foco rosa, texto negro del CTA, gradiente de marca y los demás módulos.
- **Implementación:** `theme/modern.css` intercambia los dos valores de `--company-submit-accent` (borde superior, CTA y hover); `empresa/index.html` actualiza la versión del CSS. Base de implementación: `830cec7ae4453162dc89342d7c084c65bf41c23b`. Reversión: revertir el commit de esta corrección. No hay cambios de JS, datos ni backend.
- **Validación:** comprobación estática de los dos tokens, consumidores y enlace de CSS; QA visual de ambos temas y producción pendiente de verificación independiente.

## Switch global de apariencia — 24/11/2026
- **Decisión del titular:** sustituir el menú desplegable por un switch visual sol/luna de dos posiciones, compartido por las cuatro rutas. Tema claro: indicador amarillo; oscuro: indicador cian. Etiqueta accesible ES/EN, foco rosa y movimiento reducido respetado.
- **Preferencia:** se conserva `cga-appearance` y el seguimiento automático del dispositivo hasta la primera elección manual; después se guarda claro/oscuro. No hay una tercera posición ni retorno explícito a automático en la interfaz. Sin cambios de permisos, CRM o backend.
- **Implementación:** `theme/theme.js`, `theme/theme.css`, limpieza de estilos anteriores en `theme/modern.css` y versión de recursos en los cuatro HTML. Base: `af2fa6ce2f4f66a04cb756f081ba2384d16d7218`. Reversión: revertir el commit de esta corrección.
- **Validación:** comprobaciones de lógica y referencias estáticas; QA visual de escritorio/móvil y despliegue pendientes de verificación independiente.

## Prototipo vista revista — 24/11/2026 (rama de pruebas)
- **Decisión del titular:** evaluar StPageFlip como experiencia de revista. Upstream MIT, paquete page-flip 2.0.7; fuente y licencia verificadas en GitHub. Carga CDN versionada; disponibilidad del artefacto en navegador pendiente. No hay cambios en main/producción.
- **Implementación:** botón «Vista revista» (ES/EN) en el portafolio, opt-in y URL `?lang=es&vista=revista` o `?lang=en&vista=revista`. `portafolio/magazine.js` integra el PDF.js ya cargado con StPageFlip, páginas cercanas renderizadas en cola, caché limitada, enlaces de anotaciones y fallback. Si el PDF tiene páginas apaisadas evita duplicar pliegos; si es vertical, vista doble según ancho. El zoom y el ajuste retornan al lector normal; descarga, impresión, compartir, CV, secciones y visor nativo no se reimplementan. Se conserva el PDF fuente, tema e idioma.
- **Base:** `8cc073637367bc0abdeb27f11fd39002cd1c07b2`. Archivos: `portafolio/index.html`, `portafolio/lector-v10.js`, `portafolio/magazine.js`, `portafolio/magazine.css`, `portafolio/THIRD_PARTY_STPAGEFLIP.txt`. Prueba aislada; no despliegue. Reversión: descartar la rama o revertir el commit antes de integrar.
- **Aceptación pendiente:** abrir ES/EN en escritorio y móvil, verificar proporciones reales, gestos, plegado y legibilidad de primeras/últimas páginas, vínculos, navegación por sección, retorno y zoom, descarga e impresión, carga lenta/fallo CDN, memoria y contraste. El prototipo no acredita QA visual ni ejecución real de StPageFlip.
- **Refuerzo del prototipo:** se invalida el render del lector al entrar en revista, se bloquean navegaciones simultáneas durante la apertura y se toma la relación de aspecto mediana de las primeras tres páginas para tolerar una portada atípica. Validación estática de sintaxis; no equivale a prueba del PDF real.

## Integración de vista revista en main — 24/11/2026
- **Autorización del titular:** integrar StPageFlip al sitio oficial mientras se prepara la nueva edición A4 del portafolio. Base aprobada: `dfa1f84e6add0d2a5f37724222da127949c4ed19`. Se conserva el lector convencional como vista inicial y «Vista revista» como alternativa visible hasta validar la nueva maquetación. No se cambia el PDF, sus archivos, Supabase ni el CRM.
- **A4:** la proporción se calcula desde las primeras tres páginas del PDF real; la vista de una/dos páginas depende del espacio y la proporción. Si la nueva edición modifica paginación o separa pliegos A3, revisar los destinos de las cinco secciones ES/EN y los enlaces internos antes de dar por validada la edición. No reutilizar el mapa histórico sin cotejo.
- **Validación previa:** sintaxis JS y referencias estáticas, más pruebas simuladas anteriores. QA real, entrega de GitHub Pages y nueva edición A4 no verificados. Reversión: revertir los cambios del prototipo (commits `792be18` y `dfa1f84`) junto con este registro de integración; base anterior `8cc073637367bc0abdeb27f11fd39002cd1c07b2`.

## Doble página y zoom integrado — 24/11/2026
- **Decisión del titular (capturas de producción, edición de 108 páginas):** conservar dos hojas enfrentadas tanto en revista como en clásico, también al aumentar el zoom. El zoom ya no cambia de lector. La portada conserva su posición derecha con espacio izquierdo; si la última hoja queda sin pareja, se reserva el lado faltante.
- **Implementación:** StPageFlip fuerza modo pliego; ambos lectores comparten proporción real del PDF, cálculo de tamaño y navegación por pliegos (1, 2–3, 4–5...). Ajuste inicial ocupa todo lo posible del alto/ancho útil con 4 px de margen vertical, sin tope fijo de 1200 px; zoom relativo 50–300% y ajuste ancho, con desplazamiento cuando exceda la pantalla, incluso móvil. El clásico renderiza dos hojas PDF.js y sus anotaciones; visor nativo solo como recuperación ante errores. Se conserva impresión/descarga del PDF fuente. Mayor calidad de rasterización progresiva según tamaño, con caché acotada.
- **Alcance:** `portafolio/index.html`, `portafolio/lector-v10.js`, `portafolio/magazine.js`, `portafolio/magazine.css`. Sin modificar PDF, Supabase, CRM ni permisos. Base `31e7225ecc583c2edd9e694ab635862beb423a44`; reversión: revertir este commit. La edición de 108 páginas requiere auditoría separada de índices ES/EN; no se cambian destinos sin evidencia.
- **Validación:** sintaxis, cálculo de pliegos y geometría mediante pruebas simuladas; QA visual con PDFs reales y despliegue pendientes.

## Corrección del área de desplazamiento — 24/11/2026
- **Reporte del titular:** barras de desplazamiento y espacio sobrante al 100 % en la revista, particularmente al cambiar a pantalla completa. El diseño no debe permitir desplazarse fuera del pliego ajustado.
- **Implementación:** dimensiones explícitas del stage, contención del desbordamiento de las hojas transformadas, cálculo del scrollport sin barras previas y activación por eje exclusivamente cuando el pliego excede el espacio útil. Ajuste a página sin barras; ajuste al ancho reserva la barra vertical si corresponde; zoom manual conserva desplazamiento necesario y centra el área sin excedentes artificiales. Ambos visores comparten el cálculo. Sin cambios de PDF, temas, CRM o permisos.
- **Base:** `4644a0e3ccca78a637c5d408b998e2326e7b13fd`. Reversión: revertir este commit. Validación: sintaxis y simulación de geometría con barras clásicas/superpuestas; pendiente comprobación visual en Brave, escritorio/móvil y pantalla completa con los PDF reales.

## Continuidad ES/EN y switch de apariencia — 24/11/2026
- **Reporte del titular:** control de tema no visible (posible pista colapsada) y retorno a portada al cambiar idioma.
- **Corrección:** pista sol/luna con ancho explícito, centrado flex y tamaños existentes, referencias CSS actualizadas en las cuatro rutas; ajuste compacto del menú de contacto en móviles pequeños. Se preservan colores amarillo/cian, preferencias y accesibilidad del switch.
- **Continuidad de lectura:** `lang/i18n.js` conserva `pagina`, `vista` y otros parámetros; el lector sincroniza la página al aceptar la navegación, antes del render. En una edición más corta se usa la última página válida; la portada es el valor por defecto si no hay página en el enlace. Se conserva el modo revista/clásico y el pliego, sin presumir equivalencia editorial entre ediciones.
- **Validación:** sintaxis, URLs simuladas y comprobaciones estáticas; QA visual y publicación pendientes. Base: `621a94ac8f4eb81b051e6b597a1863bcdad63c24`. Reversión: revertir este commit. Sin cambios de PDF, backend, permisos ni diseño de pliegos.

## HOME — tarjetas de idioma con efecto cristal
- Solicitud del titular: sustituir bordes amarillo/rosa/cian de ambas tarjetas por vidrio neutro translúcido. Se conserva el degradado del título, los enlaces, la composición, el selector de tema y todas las demás rutas.
- Implementación en `theme/modern.css` y actualización de caché de la HOME en `index.html`. Reflejos y sombras neutros, variantes claro/oscuro, foco visible, contraste reforzado y movimiento reducido. Sin dependencias nuevas ni cambios de backend. Base: `39bcc18d8960bd346392d9f56c6d93cbf066fa8d`; reversión: revertir este commit.
- Validación estática de alcance, enlaces y CSS; comprobación visual en navegador pendiente.

## Política cromática funcional — 24/11/2026
- Decisión del titular: reducir saturación visual; cian en oscuro, amarillo en claro, rosa excepcional. Se conserva la paleta de marca y el degradado editorial de HOME. Superficies, botones secundarios y divisores neutros; foco accesible cian/ocre oscuro (derivado del amarillo) según tema. Rosa reservado a avisos de error, rechazo o acciones destructivas; estados mantienen etiquetas.
- Se actualizan los tokens y estilos de HOME, portafolio, portal empresas y administración, incluyendo selector de CV, modalidad de contratación, diálogo sin CV y navegación. No se altera comportamiento, PDF, backend ni permisos. Base: `fab4e1c47d9e3729789d1a7b5d9c34a60097dd43`; reversión: revertir este commit.
- Validación estática de tokens, referencias y alcance; pendiente revisión visual en ambos temas.

## HOME — composición móvil y banderas SVG
- Solicitud del titular: tarjetas de cristal más compactas y centradas, una columna en móvil incluso en pantallas anchas, banderas gráficas GB/ES y línea degradada más corta.
- Se modifica exclusivamente la HOME mediante `index.html` y reglas acotadas de `theme/modern.css`. Decisión de diseño: breakpoint de 900 px; tarjetas de hasta 290 px en móvil, con iconos SVG integrados sin dependencia de fuentes emoji ni servicios externos; línea de hasta 420 px (230 px en móvil). Se conservan enlaces, tema, glass effect, foco y reducción de movimiento.
- Validación estática de estructura y alcance; QA visual en dispositivos pendiente. Base: `c6aec4833634d67dcee8fdce34e1aa0d3461db23`. Reversión: revertir este commit.

## HOME — equilibrio de escala móvil (segunda iteración)
- Evidencia: captura del titular en dispositivo real; título y tarjetas de anchos diferentes, contenido reducido en relación con la pantalla y espacio superior excesivo.
- Se alinea el título, acento y tarjetas en un único bloque de hasta 360 px, con márgenes laterales adaptativos de 24–28 px, tarjetas de altura mínima 100 px y tipografía jerarquizada. Se desplaza el centro visual ligeramente hacia arriba sin fijar alturas ni cortar contenido. Se conservan SVG, cristal, navegación, contraste y escritorio. Cambios solo en HOME; base `af2177f217d686618b7c623ddd06e9abe3fb79c8`; reversión mediante revert del commit.
- Verificación estática de estructura, anchos calculados y reglas responsive; validación visual real pendiente.

## HOME — refinamiento del título bilingüe en móvil
- Solicitud del titular: una línea por idioma, menor tipografía, separación entre frases y degradado del ancho de las tarjetas.
- Se separan las frases en elementos con idioma semántico, se ajusta la tipografía móvil a 22–30 px con 9 px de separación y se extiende la línea al ancho del bloque. Se mantiene el ajuste natural de texto para accesibilidad y el escritorio sin cambios visuales. Base: `a03455c8a04a3d545a0f9ff6c356e4103be4d479`; reversión: revertir este commit.
- Verificación estática de estructura, reglas CSS y enlaces; validación visual pendiente.

## Portafolio — entrada en revista y zoom gestual
- Solicitud: ambas tarjetas HOME abren revista; rueda del mouse y pellizco táctil amplían/reducen ambas vistas sin abandonar el pliego. Arrastre desplaza el contenido ampliado; swipe horizontal a escala de ajuste cambia pliego. Se mantiene el lector clásico explícito y su fallback. Zoom de 50–600 % relativo al ajuste; rueda sobre lector, Shift+rueda/horizontal para desplazamiento. Se conserva navegación, tema y documentos.
- Implementación: `index.html`, `portafolio/index.html`, `lector-v10.js`, `magazine.js`, `magazine.css`. Vista clásica previsualiza el zoom sobre canvas existente y vuelve a rasterizar al terminar; revista conserva StPageFlip y el tamaño de pliego. Base `8d0e874f1a651bde907b72866d48632d03c3f007`; reversión mediante revert del commit. Sin cambios en backend o PDF.
- Validación estática de integración y sintaxis; pendiente QA real en Chrome/Brave, Android/iOS y dispositivos táctiles.

## Portafolio — estabilización de zoom y arrastre
- Incidencia reportada por el titular: temblor del pliego al ampliar e imposibilidad de desplazarlo. Causa identificada en código: reinicio de overflow y actualización del motor StPageFlip en cada fotograma de zoom, con manejadores de gestos superpuestos.
- Se mantiene StPageFlip a escala de ajuste dentro de una superficie exterior escalable; no se ejecuta book.update() por zoom, solo ante cambios reales de viewport. Se estabiliza el scrollport y se difiere la mejora de resolución. Un controlador de punteros gestiona arrastre y pellizco; el gesto horizontal en ajuste activa la animación de paso de página, sin previsualización de esquina del motor durante el arrastre. Se conservan botones, enlaces y doble página. Base `a0e86a24c331b4c0141f3eaf81b6f4d05e71abfd`; rollback: revertir este commit.
- Validación: sintaxis de ambos scripts y prueba simulada de geometría, ausencia de actualización del motor durante zoom y desplazamiento disponible; validación visual y táctil en navegador real pendiente.

## Portafolio — lectura enfocada y revista adaptable
- Aprobación del titular: sustituir zoom personalizado por modo lectura. HOME sigue abriendo revista. Revista y clásico se ajustan a una página en pantallas verticales de hasta 1100 px y a doble página en el resto. Swipe horizontal y botones navegan; tocar una hoja no enlazada abre lectura individual a ancho disponible (máx. 980 px), con scroll vertical nativo y PDF.js de alta resolución. Botón Modo lectura como alternativa accesible. Cerrar conserva el pliego y el modo; los enlaces reales del PDF conservan su función. No se interceptan rueda ni pellizco del navegador.
- Cambios: `portafolio/index.html`, `lector-v10.js`, `magazine.js`, `magazine.css`. Se elimina lógica de zoom activo. StPageFlip conserva animación y cambia orientación por geometría; no se sustituye por otro visor. Base `995e90721547b24cb61a388f55a7225b555a9071`. Rollback: revertir este commit. Sin cambios en documentos PDF, backend ni HOME.
- Validación: sintaxis JS, navegación y geometría simuladas, comprobación de referencias DOM; QA de interacción real y despliegue pendientes.

## Portafolio — StPageFlip original y cámara v0.5 (aprobación de producción)
- Titular aprueba el prototipo `Portafolio_StPageFlip_original_v05.html`: agarre y plegado nativos de StPageFlip 2.0.7, doble clic/toque, fórmula intermedia de acercamiento v0.5, arrastre y retorno al mismo pliego. Se recuperan doble página y efecto tridimensional en revista para todas las orientaciones; clásico conserva su adaptación anterior y diálogo de lectura.
- Integración acotada a `portafolio/index.html`, `magazine.js`, `magazine.css`, `lector-v10.js`. Se mantiene PDF.js y PDF de producción como fuente, caché, anotaciones, navegación por índice, enlaces, idioma, descarga, impresión, compartir, pantalla completa y portal de CV. No se incorporan imágenes estáticas del prototipo. Cámara por transform externo; el gesto de papel queda en StPageFlip. Los controles de navegación y enlaces internos retornan al pliego antes de navegar; enlaces externos siguen activos. No se modifica backend, documentos, HOME ni otras rutas.
- Base `db25823551f309da6318603f64d18cbe2120f612`; reversión: revertir este commit. Validación: sintaxis, estructura DOM, invariantes de enlaces y fórmula de escala/limites; QA de motor real en producción pendiente. El prototipo fue aprobado por el titular en navegador.

## Portafolio — aislamiento de arrastre de lectura
- Titular solicita indicación «Doble toque para leer de cerca» y reporta superposición de páginas/bloqueo de arrastre al acercarse. Se retira la mención de la esquina (ES/EN). Diagnóstico de código: el motor StPageFlip registra eventos globales aun cuando se bloquea el inicio del gesto, y el DOM animado puede solaparse con el desplazamiento.
- Modo de cámara usa una superficie plana dentro del mismo pliego, alimentada por la misma caché de raster PDF.js y anotaciones; se oculta temporalmente el DOM animado y se bloquean sus eventos de movimiento durante lectura. Se impide arrastre HTML nativo, se captura el puntero de manera estable y se mantiene la navegación de enlaces. La geometría y fórmula v0.5, el agarre nativo al volver, el visor clásico y todas las funciones ajenas al cambio permanecen. Base `8cc94568851d744e22db5320b97393d98225f731`; reversión: revertir este commit.
- Verificación de sintaxis, invariantes y alcance; comportamiento visual/táctil real pendiente.

## Portafolio — controles laterales en móvil horizontal
- Titular autoriza publicación directa para probar en el teléfono. Se aplica únicamente a paisaje con puntero táctil principal, altura hasta 600 px y ancho hasta 1180 px. Dos carriles de 54/58 px con scroll propio, área central de altura completa; iconos para navegación, vistas y lectura, capítulos dentro de un menú lateral. Se conservan los nodos originales y sus listeners, incluidos tema, idioma, contacto, compartir, copiar, imprimir, descargar/CV y paginación. Los menús flotan hacia el centro. Se mantiene acceso permanente a los controles durante lectura (decisión para no alterar la cámara al ocultarlos). El escritorio y móvil vertical conservan su disposición original.
- Ajuste de geometría: reserva vertical revista 22 px en horizontal táctil frente a 38 px anterior, sin cambiar fórmula de acercamiento v0.5 ni motor StPageFlip. Archivos: `portafolio/index.html`, `magazine.css`, `magazine.js`, este registro. Base `03a97aa6064ca590733596a6399003ce36ad504c`; reversión: revertir este commit. No hay cambios de PDF/backend.
- Validación estática: sintaxis, nodos únicos y referencias, consistencia de media queries y geometría simulada. QA visual/táctil real y despliegue pendientes.

## Portafolio — flechas independientes en móvil horizontal
- Titular aprueba barras laterales y solicita anterior/siguiente en los espacios entre revista y barras. Se reutilizan los botones `sidePrevious` y `sideNext` del lector, centrados verticalmente y ubicados en el centro de cada margen de revista; se ocultan solo las flechas duplicadas del formulario lateral. Paginación, controles, listeners, navegación 3D y zoom permanecen. En pantallas con margen insuficiente se garantiza un mínimo de 52 px para una flecha de 44 px sin tapar las hojas; durante acercamiento quedan en el borde del área central. Escritorio y móvil vertical sin cambios.
- Base `b1fc8701f058ad80693ea6bd4151b699f5312fe9`; reversión mediante revert. Validación estática de sintaxis y geometría simulada; pendiente prueba visual real.

## Notificaciones internas de solicitudes — Resend
- Dominio de envío verificado por el titular: `notificaciones.christianarleo.com` (Namecheap, São Paulo). Destinatario fijo: `hola@christianarleo.com`; remitente `alertas@notificaciones.christianarleo.com`. Secreto `RESEND_API_KEY` configurado por el titular en Supabase; nunca se almacena en Git.
- Se mantiene la función existente `portfolio-cv-portal` y las acciones `lead_v3`, `lead_v2`, `lead`. Solo tras persistir la solicitud se inicia la notificación con EdgeRuntime.waitUntil. El fallo del proveedor no modifica el registro ni la respuesta al visitante. No se envía correo a terceros ni se incluyen datos de contacto, textos libres o CV privados en el correo; se consultan en el CRM autenticado.
- Hasta tres intentos en errores transitorios (timeout, red, HTTP 408/429/5xx), mismo payload e Idempotency-Key por UUID persistido. Logs `lead_notification_accepted` / `lead_notification_failed` / `lead_notification_retry` / `lead_notification_http`: aceptación de proveedor no equivale a entrega. Sin cambios en tablas, permisos, RLS ni DNS. No hay cola durable ni reintentos programados tras agotamiento; requerirían una fase posterior. No se garantiza deduplicación de dos solicitudes distintas enviadas por el visitante.
- Base Git `90c1819d61a2c831cb2cd1253167113c50ca8099`, Edge Function v9. Reversión: redeploy del index.ts v9 con su deno.json original y revert del commit. Pruebas simuladas de reintento, fallo permanente, agotamiento, secreto faltante, escape HTML y destinatario fijo; entrega real pendiente.

## Confirmación al solicitante — piloto controlado
- Plantilla ES aprobada por el titular, asunto «Recibí la solicitud | Christian Gabriel Arleo», firma de 23 px con degradado #DF3E89–#FCD200, WhatsApp/LinkedIn/portafolio/correo y versión EN traducida. HTML con tabla de colores de respaldo, texto plano y Reply-To `hola@christianarleo.com`. Adaptación de color sujeta al cliente de correo.
- PILOTO: solo si el correo persistido coincide exactamente con `hola@christianarleo.com`; máximo dos solicitudes con esa dirección en ventana móvil de 15 min, fallo cerrado si no se puede consultar el límite. Otras solicitudes se guardan y conservan el aviso interno; no reciben todavía confirmación. No crear endpoint público de pruebas. Activación general pendiente de protección antiabuso robusta (CAPTCHA validado en servidor, límites persistentes).
- Registros separados `lead_confirmation_accepted`, `lead_confirmation_failed`, `lead_confirmation_skipped`, `lead_confirmation_http` y `lead_confirmation_retry`. Idempotencia `portfolio-confirmation/<UUID>`, independiente de alerta interna. Hasta 3 intentos transitorios, sin cola durable. No se modifican DNS, permisos ni esquema de BD.
- Pruebas simuladas: ES/EN, nombre ausente, escape HTML, destinatario externo bloqueado, límite, secreto faltante, errores 401/503 y reintento idempotente. Prueba real pendiente del titular desde formulario. Rollback: redeploy Edge Function v10 y revertir commit (base b69cac541fe60cd257730d739e5f7e0ddaa766b1).

### Portal empresa — regreso después de propuesta (2026-11-25)
- En la confirmación exitosa se muestra «Volver al portafolio» / «Back to portfolio», con enlace al lector y el idioma activo. Acción oculta antes de éxito; accesible por teclado y con área de 44 px. No cambia el formulario, el backend ni las notificaciones. Archivos: empresa/index.html y empresa/empresa.js (cache bust success-back1). Verificación sintáctica JS y de ramas DOM; comprobación visual en producción pendiente.

### Portal empresa — acciones sociales de confirmación (2026-11-25)
- Se amplía el bloque de regreso con «Contacta por WhatsApp» y «Sígueme en LinkedIn» (ES/EN). Enlaces del portafolio existente, apertura en nueva pestaña con noopener/noreferrer; mensaje de WhatsApp localizado. Acciones secundarias con tokens de tema, 44 px y disposición vertical móvil. Solo tras éxito, sin cambios en CRM, DNS o Edge Functions. Verificación sintáctica y de enlaces; QA visual en producción pendiente. Base 7d9ff4bf29ead44ab8c84bf28d94c482e6c7c36e.

## Turnstile y confirmaciones externas — transición (2026-11-25)
- Turnstile Gestionado: site key pública en empresa/empresa.js; secreto TURNSTILE_SECRET_KEY en Supabase, nunca en Git. Widget cargado al abrir formulario, acción portfolio_lead; Siteverify exige success, hostname autorizado y action. No se registra token ni secreto. Reinicio ante error/expiración sin perder datos. Sin token (cliente anterior) se guarda solicitud sin notificaciones, como transición de caché; tras comprobar Pages y desafío real, exigir token para todos los formularios. Token inválido: 400; proveedor indisponible: 503; mostrar reintento/contacto.
- Se elimina lista piloto para solicitudes verificadas. Confirmación al correo persistido, plantilla aprobada ES/EN, Reply-To Zoho. Límites iniciales: 2 solicitudes/destinatario/24h para confirmación; 30 solicitudes globales/24h y 8/15min para ambos correos (cuentan filas CRM, no entregas; no son cuotas exactas de Resend). Fallo de consulta o límite: conservar CRM y registrar omisión. No se modifica esquema, RLS, DNS ni correo entrante. Sin reenvío retroactivo. El modo legacy no dispara correos. Turnstile no verifica propiedad del correo.
- Pruebas simuladas: 11 casos de desafío/hostname/action/expiración/ausencia/secreto/red/límites, confirmación externa y límite destinatario; sintaxis JS. Prueba real y Pages pendientes. Base 8a9382e8dcd456edf31b3651189dad3a87116bcc, Edge v12. Rollback: restaurar v12 y revertir commit.

## Confirmación única con CCO — 2026-11-25
- Decisión del titular: sustituir la alerta interna independiente por el mismo correo de confirmación al solicitante, con CCO a hola@christianarleo.com y una segunda casilla privada configurada mediante PORTFOLIO_PERSONAL_BCC_EMAIL (secreto Supabase, no publicar dirección personal). Excluir duplicados To/CCO. Sin reenvío de solicitudes previas. Mantener ES/EN, firma, Reply-To, Turnstile, límites CRM e idempotencia.
- Se elimina notifyNewLead y el envío portfolio-lead; queda únicamente portfolio-confirmation. Si se alcanza un límite, CRM conserva la solicitud pero no se envía confirmación ni CCO. Configuración del remitente opcional PORTFOLIO_FROM_EMAIL=hola@christianarleo.com solo después de verificar dominio principal en Resend y autorizar API key compatible. Hasta entonces conservar remitente del subdominio verificado. No modificar DNS, MX, RLS ni esquema. La casilla personal requiere configurar el secreto; no asumir que ya existe.
- 9 pruebas simuladas satisfactorias. Base 90740144cf28525ad8c910a5e6614fb16999a1d6, Edge v13. Rollback: revertir commit y redeploy v13. Prueba real de recepción CCO pendiente.

## Video de agradecimiento tras enviar solicitud — 2026-11-25
- Archivo público confirmado por metadatos Storage: portafolio-videos/confirmacion-solicitud-es.mp4 (video/mp4, 47.913.505 bytes, bucket público 50 MiB). Sin cambios al bucket o archivo. URL se asigna únicamente después de status received; no descarga previa al formulario.
- Cierre conserva confirmación textual y las tres acciones. Video vertical 9:16 sin recorte, controles nativos y playsinline; desktop video + acciones, móvil acciones debajo. Intento autoplay con sonido, fallback silenciado con botón Activar sonido, fallback manual si navegador bloquea ambos. Respeta preferencia de movimiento reducido/ahorro de datos. Sin loop ni pantalla completa forzada. Error de video no altera registro CRM ni dispara otro envío. ES disponible; EN usa fallback ES con aviso explícito. No se inventan subtítulos ni traducción; se podrán incorporar con archivo autorizado.
- Validación: sintaxis JS, IDs únicos, carga diferida, 5 simulaciones de autoplay/alternativas. Verificación visual y reproducción real pendientes. Sin modificaciones a Edge Function, correo, Turnstile, DNS ni RLS. Base 5228971d1522bd52206c96ce21fa0b70a15f2e6a; rollback: revertir commit.

## Enlace independiente de video — 2026-11-25
- URL pública compartible https://christianarleo.com/mensaje/ (ES por defecto, /mensaje/?lang=en interfaz EN con video ES). Página de presentación neutral, noindex, sin identificador de empresa, sin llamadas CRM, sin correo ni registro de solicitudes. El video público ya existente no se duplica. No se modifica Storage. El contenido hablado no fue revisado; si menciona una solicitud recibida, puede requerir un video específico para contactos que no usaron el formulario.
- Reproductor y CSS extraídos de empresa a theme/message-video.js y theme/message-video.css, reutilizados por ambas rutas. Diferenciar mensajes de error en contexto de solicitud confirmada versus enlace directo. Misma política autoplay, controles, fallback, idiomas, modo claro/oscuro. Acciones portafolio, WhatsApp, LinkedIn. Pruebas sintaxis y 5 simulaciones satisfactorias; publicación y verificación visual pendientes. Base 34bb151e3fa62ab100aa1406552873915cdfbe18; rollback revertir commit.

## URL bilingüe y botones discretos en video — 2026-11-25
- Ruta canónica compartible: https://christianarleo.com/video/ (ES por defecto; ?lang=en interfaz EN). /mensaje/ queda como redirección compatible, preservando parámetros y fragmento mediante location.replace; enlace alternativo sin JS. Se mueve la página a video/, sin duplicar el MP4 ni el reproductor; antiguo JS se conserva por compatibilidad de caché.
- En /video/ y cierre de /empresa/, sustituir actionLink y action del control de sonido por clases dedicadas messageCta/messageSound; tarjetas compactas glass neutras derivadas de HOME, modo oscuro y claro, sin rellenos cian/amarillo, foco visible neutro. Eliminar dependencia de estilos globales de CTA de acento. Mantener destinos y etiquetas, video protagonista, layout responsivo. Sin cambios de CRM, correo, Supabase o Turnstile. Cache-bust CSS. Verificaciones estáticas y prueba de redirección satisfactorias; inspección visual en producción pendiente. Base 9beb6c58663961b2dadd609f1e07726373b9ce32; rollback revertir commit.

## Video: distribución vertical en dispositivos móviles — 2026-11-25
- Corrección solicitada tras captura de /video/ en celular: el breakpoint de 660px no cubría todos los viewports móviles. CSS compartido: una columna hasta 760px o dispositivos táctiles primarios sin hover, independientemente de su ancho/orientación; video y control de sonido arriba, tres tarjetas glass debajo, ancho máximo común 360px y proporción 9:16 sin restricción de altura en móvil (scroll natural). En escritorio con mouse y ancho >760px se conserva la distribución original a dos columnas. Sin cambios JS, video, contactos ni backend. Cache-bust aplicado a /video/ y /empresa/. Verificaciones estáticas de reglas y nueve casos de breakpoint; pendiente visual real. Base 2357d87202531f951014fd05b494d8c8c209b6eb; rollback revertir commit.

## Video: acceso explícito a ambas revistas del portafolio — 2026-11-26
- Se reemplaza el CTA único de portafolio por dos tarjetas glass compactas reutilizando exactamente banderas SVG y textos bilingües del HOME, English y Español. Los destinos son /portafolio/?lang=en&vista=revista y /portafolio/?lang=es&vista=revista, independientes del idioma de interfaz. Mantener WhatsApp y LinkedIn, diseño vertical móvil y horizontal escritorio, video protagonista y colores neutros. Aplica a /video/ y confirmación de /empresa/. Eliminar referencias JS al CTA único; invalidar caché CSS/JS. Sintaxis y comprobaciones de enlaces/markup verificadas; QA visual real pendiente. Sin cambios backend. Base ff62deeaa299272717c0b1faf717cc24f9ddbf00; rollback revertir commit.

## Entradas directas bilingües al portafolio — 2026-11-26
- /portafolio/ sin idioma explícito inicia en ES y revista si no existe vista explícita; normalización de query con history.replaceState antes de i18n y lector (sin navegación extra). Los accesos previos con lang válido conservan vista/página, incluyendo lector clásico sin vista; conservar parámetros y fragmento en normalización. /portfolio/ es alias EN por defecto y vista revista si no indicada; redirección con location.replace al lector único, preservando parámetros y fragmento; enlace alternativo sin JS. Sin duplicar lector ni PDFs, ni modificar controles de idiomas. La URL final usa /portafolio/?lang=…&vista=revista. Metadatos iniciales ES coherentes con ruta principal; i18n actualiza canonical/OG según idioma. 10 pruebas de lógica de entrada satisfactorias; pendiente publicación y comprobación real. Base 4fbe5a52306d4f329ecc452356d981f646eafb8e; rollback revertir commit.

## Confirmación y próximos pasos antes del video — 2026-11-26
- /empresa/: sustituye el cierre genérico por agradecimiento explícito y registro confirmado, bloque visible «¿Qué pasa ahora?» con dos pasos: revisar confirmación automática en el correo ingresado y expectativa de contacto humano según preferencia (email, WhatsApp, llamada o empresa contacta). No prometer entrega: el email se procesa de forma independiente y puede omitirse por límites; copy «Deberías recibir» + revisión de spam y persistencia de CRM. Mostrar dirección solo con textContent en la sesión del propio solicitante; sin persistencia adicional. Introducción al video después de los pasos, tarjetas neutras responsivas y foco accesible. ES/EN. Mantiene video, acciones y flujo de registro; /video/ independiente no cambia, sin tocar correo/Edge Function/Turnstile. 8 combinaciones de idioma/preferencia y sintaxis JS verificadas; prueba visual y real pendiente. Base 0a2da101a298a016b0b5045b5b6299585284b7cd; rollback revertir commit.

## Cierre del formulario: confirmación compacta e integrada — 2026-11-26
- Ajuste solicitado: retirar tarjetas de próximos pasos y texto redundante. Cabecera única con confirmación y check neutro, una frase sobre contacto según preferencia, una línea de correo con icono y aviso Spam sin afirmar entrega; breve título integrado sobre video. Divisor neutro y separación compacta. Mantener acciones glass, idiomas y layout móvil/desktop. Solo /empresa/, sin cambios al video compartible, CRM, backend ni correo. 8 combinaciones ES/EN verificadas y sintaxis JS correcta; comprobación visual pendiente. Base 820697c0e835a2373374ef527803f25ba8bc0c70; rollback revertir commit.

## Miniaturas Open Graph por URL — 2026-11-25 (Lima)
- Cuatro PNG 1254×1254 aprobados y subidos por el titular. Se renombran sin recodificar ni duplicar blobs: .web.png → assets/og/og-home.png; .porta.png → assets/og/og-portafolio.png; .Port.png → assets/og/og-portfolio.png; .video.png → assets/og/og-video.png. Evitar archivos ocultos en GitHub Pages. Se verifica firma PNG, dimensiones y correspondencia visual de portadas ES/EN.
- Metadatos estáticos OG y Twitter en HTML de /, /portafolio/, /portfolio/ y /video/, URL HTTPS absoluta, imagen, título, descripción, dimensiones, texto alternativo. Alias inglés mantiene redirección del navegador; metadata EN disponible antes de JS. Alcance: cuatro URLs limpias; enlaces con query del lector único pueden recibir la portada estática ES en crawlers sin JS. Sin tocar lector, video, SEO canonical existente ni backend. WhatsApp decide recorte y caché; prueba de vista previa real pendiente. Base 730337c6a51c42f141f0384ee3a42c57117cc730; rollback revertir commit.

## HOME: microinteracción glass con glow y press — 2026-11-25 (Lima)
- Aplicar solo tarjetas English/Español de HOME, usando CSS nativo en theme/modern.css y tokens existentes --cga-accent (cian oscuro, amarillo claro). Sin brillo cromático permanente: degradado translúcido, resplandor y flecha animada en hover/foco, reflejo discreto WebKit en escritorio compatible, compresión .92 en active y retorno de 600 ms. Mantener texto de alto contraste según tema, sin forzar negro sobre el extremo oscuro del degradado. Touch feedback sin hover persistente cromático; teclado, reduced motion y contraste alto contemplados. No agregar dependencias ni retrasar navegación. CSS cache-bust solo HOME; video/empresa/lector/backend sin cambios.
- 9 comprobaciones estáticas satisfactorias; prueba visual real pendiente. Base d83aef72e3ce294c531eaccaf5d5e8a942d1dd6d; rollback revertir commit.

## Switch global: morph sol/luna — 2026-11-25 (Lima)
- Adaptación del componente HTML/CSS aportado a la lógica existente theme/theme.js y theme/theme.css. Un único icono de nueve piezas en el thumb se transforma de sol a luna y se desplaza con transición de 300 ms; rayos se retraen y desaparecen. Amarillo claro y cian oscuro según tokens oficiales, pista tintada y símbolo negro para contraste. Conserva botón nativo role=switch, estado aria-checked, foco, etiquetas ES/EN, almacenamiento cga-appearance, preferencia de sistema y sincronización entre pestañas. No se usa theme__fill ni mix-blend-mode global: invertiría PDF e imágenes; el cambio real usa tokens existentes. Se conservan dimensiones y reglas de lector móvil; reduced motion y forced colors contemplados.
- Cache-bust de CSS/JS en HOME, portafolio, empresa, video y admin; alias redirect sin cambios. 4 escenarios simulados de inserción/estado inicial/click/storage/sistema, sintaxis JS y comprobaciones estáticas CSS satisfactorias. Sin dependencias ni cambios al lector/CRM/backend. Verificación visual pendiente. Base 11502e41034f5b0f5fa84549daecd46e78f41392; rollback revertir commit.

## HOME: accesos sociales animados — 2026-11-25 (Lima)
- Agregar únicamente LinkedIn y WhatsApp al encabezado de HOME entre nombre y switch existente. Reutilizar URLs del video, SVG del componente aportado, enlace accesible externo en nueva pestaña con noopener/noreferrer. Superficie neutra según tema, color propio de red en interacción, animación entrada vertical 300 ms y escala .9 al presionar. Botones 52px escritorio, 44px móvil, foco y reduced motion. Sin tarjeta contenedora voluminosa ni duplicación del switch; alcance index.html y CSS HOME, sin modificar lector, formularios ni backend. 10 comprobaciones estáticas satisfactorias; prueba visual y de destino pendiente. Base 68a2d784e8c37ece46ee2485d6f0db30b885eb88; rollback revertir commit.

## Lector: iconos de contacto animados — 2026-11-25 (Lima)
- Sustituir etiquetas visibles LinkedIn, WhatsApp, E-mail y Llamar del encabezado y menú móvil por iconos SVG con etiquetas accesibles/títulos ES/EN; conservar href, destino y cierre de menú. Reutilizar animación HOME (300 ms, entrada desde arriba, press .9); LinkedIn azul, WhatsApp verde, correo/teléfono acento del tema. Barra 34px, menú 44px. Sin cambios a PDF, acciones de compartir, navegación ni backend. Cache-bust CSS HOME/lector. 9 comprobaciones estáticas satisfactorias; QA visual pendiente. Base d658c40cfa89a677e117eb8b7726906a3c6a6eab; rollback revertir commit.
