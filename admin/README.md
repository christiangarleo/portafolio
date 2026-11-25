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
