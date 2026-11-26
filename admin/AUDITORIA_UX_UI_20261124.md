# AUDITORÍA UX / UI / SEGURIDAD — christianarleo.com

**Fecha:** 2026-11-24 · **Alcance:** `/`, `/portafolio/`, `/empresa/`, `/admin/`, Edge Function `portfolio-cv-portal`, Auth, RLS y Storage de Supabase.

**Método y límite:** inspección del código vigente en `christiangarleo/portafolio` (`main`), consultas de esquema/políticas/advisors de Supabase y revisión de las capturas compartidas por el propietario. **NO_VERIFICADO:** auditoría visual por navegador real (desktop/móvil), Lighthouse, VoiceOver/NVDA, envío E2E y tiempos reales de carga. Los estados «EJECUTADO» se refieren a implementación validada a nivel de código y/o esquema; no equivalen a test de aceptación en producción.

## Modelo de acceso obligatorio

- **Titular:** exactamente una identidad administrativa aprobada (user ID + correo verificado). No se crea ningún rol adicional ni se ofrecen altas desde la interfaz.
- **Reclutador/interesado:** acceso público sin autenticación al portal de su identificador empresarial. **No existe back office autenticado para reclutadores**; ese cambio sería una decisión posterior que requiere modelo de acceso distinto.
- Los identificadores RUC, RFC, NIT, RUT, CUIT, CNPJ, EIN, VAT, NIF/CIF y ABN **no son secretos**. Conocer el ID no demuestra pertenencia a la empresa; el CV privado en Storage se comparte mediante enlace firmado temporal si se conoce el identificador. No llamar «privado/autenticado» a ese flujo.

## A. Seguridad y privacidad (P0/P1)

| ID | Pri. | Hallazgo sustentado | Acción / criterio de aceptación | Estado |
|---|---|---|---|---|
| SEC-01 | P0 | El login mostraba creación de cuenta y reenvío de confirmación. | Retirar alta pública, sesión no autorizada debe cerrarse tras verificación. | EJECUTADO |
| SEC-02 | P0 | La membresía en `portfolio_cv_admins` autorizaba por UUID, sin comparar explícitamente correo. | Guardar `approved_email` confirmado, exigir coincidencia de email JWT y UUID, índice de máximo un administrador. | EJECUTADO |
| SEC-03 | P0 | El advisor detectó que `public.rls_auto_enable()` SECURITY DEFINER era ejecutable por `anon` y `authenticated`. | Revocar EXECUTE al público y mantener activo el event trigger `ensure_rls`. | EJECUTADO, VERIFICADO |
| SEC-04 | P1 | Supabase Auth permite protección contra contraseñas filtradas, pero la opción figura desactivada en el advisor. | Activar `Leaked Password Protection` desde Supabase Auth; verificar advisor sin alerta. | A_EJECUTAR |
| SEC-05 | P1 | El formulario de registro fue retirado de `/admin/`, pero no se verificó/desactivó el alta mediante la API de Supabase Auth. | Deshabilitar `Allow new users to sign up` en Auth; comprobar que un correo distinto no pueda registrarse. La autorización del administrador ya está bloqueada por RLS. | NO_VERIFICADO |
| SEC-06 | P1 | No se verificó MFA del único administrador. | Activar MFA/TOTP y disponer de método de recuperación seguro. | A_EJECUTAR |
| SEC-07 | P1 | CV consultables mediante identificadores empresariales públicos; no se comprueba pertenencia a la empresa. | Decidir formalmente si se mantiene la experiencia sin login o se agregan enlaces de acceso de un solo uso; nunca sugerir privacidad inexistente. | RIESGO_A_DECIDIR |
| SEC-08 | P1 | Edge Function pública tiene control de origen/tamaño y honeypot, pero no limitación efectiva por IP/identificador ni protección antiabuso del envío de propuestas. | Rate limit por acción y ventana, monitoreo de errores y detección de automatización, sin impedir visitantes legítimos. | A_EJECUTAR |
| SEC-09 | P1 | `persistSession:true` conserva la sesión del titular en navegador compartido. | Considerar bloqueo por inactividad, revalidación para borrar/reemplazar y cierre en todos los dispositivos. | A_EVALUAR |
| SEC-10 | P2 | PDF validado por extensión y cabecera `%PDF-`, no por inspección exhaustiva del contenido. | Guardar límites de tamaño/MIME, analizar archivos maliciosos si se habilitan colaboradores externos, registrar versiones de documentos. | A_EJECUTAR |
| SEC-11 | P2 | No se verificaron encabezados HTTP de seguridad, dependencia CDN, CSP efectiva ni seguridad de dependencias en la web publicada. | Auditar CSP, referrer-policy, permisos, SRI y cambios de CDN sin romper pdf.js/Supabase. | NO_VERIFICADO |

## B. UX — tareas y conversión

| ID | Pri. | Hallazgo / impacto | Mejora concreta | Estado |
|---|---|---|---|---|
| UX-01 | P1 | Administración anterior: cuatro bloques de trabajo apilados sin navegación. | Separar Resumen, Solicitudes, CV, Portafolios con una pantalla inicial por tareas. | EJECUTADO |
| UX-02 | P1 | No había visión inmediata de carga de trabajo. | KPIs reales: por decidir, en seguimiento, CV registrados y PDF publicados; prioridades con CTA. | EJECUTADO |
| UX-03 | P1 | CV existentes carecían de filtro por empresa, identificador o vacante. | Campo de búsqueda sin recarga y contador de resultados. | EJECUTADO |
| UX-04 | P1 | Empresa con varias vacantes debía recorrer todas las tarjetas. | Buscar por puesto y alternar Todos/Disponibles; no ocultar historial permanentemente. | EJECUTADO |
| UX-05 | P1 | El identificador empresarial sirve como llave de consulta, pero el nombre «portal» puede implicar login/validación. | Mensaje de acceso claro, sin sugerir autenticación; evaluar privacidad de CV. | A_EJECUTAR |
| UX-06 | P1 | Identificador sin país/tipo permite posibles colisiones entre registros de distintos mercados. | Evaluar normalización `país + tipo + valor`, respetando identificadores ya usados y enlaces existentes. | A_EVALUAR |
| UX-07 | P1 | Un PDF inglés y un PDF español están publicados, pero la navegación del inglés no tiene secciones verificadas (`sections:null`). | Auditar índice/paginación inglesa y configurar `sections` sin copiar números del español. | A_EJECUTAR |
| UX-08 | P1 | La internacionalización depende de un diccionario de cadenas y modificaciones de nodos del DOM. | Definir claves i18n por componente; QA de títulos, estados, validaciones y errores dinámicos en ES/EN. | A_EJECUTAR |
| UX-09 | P1 | «Abrir correo (Zoho)» crea `mailto:`, no envía ni adjunta desde el panel. | Integración autorizada de Zoho Mail para envío/adjuntos con confirmación explícita y registro de estado real. | A_EJECUTAR |
| UX-10 | P1 | WhatsApp se abre con texto precargado; el despacho se confirma fuera del portal. | Mantener confirmación manual hasta integrar WhatsApp Business; no prometer envío automático. | VIGENTE |
| UX-11 | P1 | Proponer reunión guarda fecha, pero no crea evento ni adjunta invitación. | Calendario conectado opcional, calendario ICS como solución intermedia, huso horario explícito. | A_EJECUTAR |
| UX-12 | P1 | Una solicitud entrante no genera notificación proactiva al propietario. | Alertas por correo al titular para nuevas solicitudes, sin enviar respuestas automáticas a los reclutadores. | A_EJECUTAR |
| UX-13 | P1 | El interesado recibe confirmación visual, pero no constancia por email, número de referencia ni tiempos orientativos. | Confirmación clara de recepción con seguimiento responsable, sin prometer SLA inexistente. | A_EVALUAR |
| UX-14 | P2 | El campo de nombre del reclutador queda oculto entre observaciones opcionales. | Evaluar hacerlo visible sin subir fricción; facilita personalizar la respuesta. | A_EVALUAR |
| UX-15 | P2 | Los estados `decision_status`, `status` y `application_status` cubren procesos distintos y pueden confundir al titular. | Modelo explícito: decisión de oportunidad, etapa comercial, etapa de CV; explicar cada una y sus transiciones. | A_EJECUTAR |
| UX-16 | P2 | Reemplazar PDF público requiere conservar copias manuales; borrar CV elimina Storage antes del registro DB. | Versiones/rollback del portafolio; hacer borrado reversible o coordinado y registrar actividad. | A_EJECUTAR |
| UX-17 | P2 | Subidas de 20–45 MB no muestran progreso porcentual ni validación previa de peso suficiente. | Mostrar estado, progreso, cancelación segura, tamaño y confirmación final por documento. | A_EJECUTAR |
| UX-18 | P2 | No hay instrumentación visible del embudo entrada → portal → selección CV → descarga → propuesta. | Eventos anónimos por etapa y métricas de conversión sin exponer datos personales. | A_EVALUAR |
| UX-19 | P2 | Falta un flujo autónomo de recuperación de contraseña tras cerrar el registro abierto. | Implementar recuperación exclusivamente del titular con enlaces de vida corta y sin enumerar correos. | A_EJECUTAR |
| UX-20 | P2 | El portafolio puede requerir descargar un PDF pesado antes de descubrir su contenido. | Portada/índice HTML livianos con enlaces profundos, sin eliminar el lector de PDF. | A_EVALUAR |

## C. UI — sistema visual, accesibilidad y responsive

| ID | Pri. | Hallazgo / riesgo visual | Mejora concreta | Estado |
|---|---|---|---|---|
| UI-01 | P1 | En el back office se utilizan textos de ayuda, etiquetas y metadatos de 11–12 px. | Subir tipografía base y metadatos críticos a tamaños legibles; jerarquía consistente y contraste AA. | A_EJECUTAR |
| UI-02 | P1 | El CSS móvil del portafolio reduce algunos controles a ~29–31 px. | Áreas táctiles cercanas a 44 × 44 px sin saturar la cabecera; verificar en 320/375/430 px. | A_EJECUTAR |
| UI-03 | P1 | Un solo panel largo producía saltos y pérdida de contexto. | Navegación por 4 áreas, vista Resumen, pestañas accesibles con teclado. | EJECUTADO |
| UI-04 | P1 | La guía visual usa colores fijos en CSS de las páginas y un segundo archivo con overrides de modo oscuro. | Consolidar tokens de color/superficie/foco/estado y probar todos los componentes en ambos temas. | A_EJECUTAR |
| UI-05 | P1 | Campos de error y éxito no muestran siempre el mismo patrón visual/acción de recuperación. | Patrón común: mensaje junto al campo + `aria-live` + enfoque + acción reintentar. | A_EJECUTAR |
| UI-06 | P1 | El portafolio y el portal reúnen herramientas y acciones de distinta importancia en espacios estrechos. | Jerarquía primaria/secundaria, menú overflow y QA responsivo. | A_EJECUTAR |
| UI-07 | P2 | Iconos, emojis y banderas combinan distintos estilos. | Iconografía coherente y accesible; conservar flags solicitadas pero acompañarlas por texto de idioma. | A_EJECUTAR |
| UI-08 | P2 | Dos tamaños y estilos de CTA compiten con acciones secundarias en tarjetas de CV. | Componentes `Button Primary / Secondary / Destructive`, estados hover/focus/loading/disabled. | A_EJECUTAR |
| UI-09 | P2 | Listas largas del back office no tenían resumen escaneable. | KPI, chips de estado, filtro de CV y bandejas de oportunidad con texto claro. | EJECUTADO |
| UI-10 | P2 | El diseño actual depende de estilos inline y selectores específicos que dificultan mantener consistencia. | Extraer componentes CSS reutilizables, deduplicar reglas y documentar tokens, sin reescribir la app. | A_EJECUTAR |
| UI-11 | P2 | No se verificó legibilidad de archivos/índices en modo oscuro, alto contraste y zoom 200 %. | Auditoría visual/manual con capturas y lector de pantalla; registrar defectos reales. | NO_VERIFICADO |
| UI-12 | P2 | No hay sistema coherente de estados vacíos, skeletons y progreso de PDF. | Diseñar `loading / vacío / error / éxito` por componente; no bloquear toda la vista ante fallo parcial. | A_EJECUTAR |
| UI-13 | P2 | El gradiente rosa/amarillo identifica el sitio pero se usa de forma poco sistemática. | Aplicarlo de forma contenida a acciones y marcas de navegación, respetando contraste. | A_EVALUAR |
| UI-14 | P2 | Metadatos y títulos de idiomas pueden depender de JavaScript, que los robots de previews no siempre ejecutan. | OG/canonical y metadatos estáticos por idioma; verificar previews sociales. | A_EJECUTAR |
| UI-15 | P2 | Zoom y estado de páginas PDF en móvil requieren pruebas de orientación/rotación y reflujo. | Validar tamaños, fallback nativo, scroll horizontal accidental y accesibilidad del lector. | NO_VERIFICADO |

## D. Primera entrega realizada en esta auditoría

| Componente | Antes | Ahora | Verificación |
|---|---|---|---|
| Único administrador | Membresía por UUID; login ofrecía registro | Exactamente un dueño, `approved_email` de Auth confirmado + UUID + índice único; registro retirado y sesiones no autorizadas expulsadas | Migración SQL + JS |
| Función privilegiada | Ejecutable mediante RPC desde `anon/authenticated` | EXECUTE revocado; event trigger interno `ensure_rls` sigue habilitado | Query + advisor |
| Inicio de administración | Portafolios, CV y solicitudes apilados | 4 pestañas: Resumen, Solicitudes, CV, Portafolios | Código |
| Resumen | Sin indicadores | 4 KPIs y tareas prioritarias basadas en datos reales | Código |
| CV | Lista sin búsqueda | Filtro por empresa/ID/vacante y recuento de coincidencias | Código |
| Portal empresa | Solo lista de vacantes | Búsqueda por puesto y filtros Todos/Disponibles, con estado vacío | Código |
| ES/EN | Bilingüe previo | Nuevos controles traducidos a ambos idiomas | Código |

## E. Arquitectura visual objetivo

```text
RECLUTADOR (sin cuenta)
Idioma ES / EN
  └── Identificador de empresa
        ├── CV por vacante → buscar / filtrar → descargar CV vigente
        └── Contratación In-house / Por proyecto → formulario breve

TITULAR (una sola cuenta validada)
Login exclusivo, UUID + email aprobado + RLS
  └── OFICINA PRIVADA
        ├── Resumen: indicadores y prioridades
        ├── Solicitudes: decidir → asociar CV → contacto → reunión → historial
        ├── CV: cargar → buscar → gestionar estados / vencimientos
        └── Portafolios: publicar o reemplazar ES / EN
```

## F. Orden operativo recomendado

1. **Seguridad inmediata:** desactivar nuevos registros en Auth y activar protección contra contraseñas filtradas/MFA; verificar login de cuenta única.
2. **Probar lo implementado:** teclado, temas claro/oscuro, mobile, cambio de pestañas, filtro CV, flujo de oportunidad y carga de documentos.
3. **Conversión/experiencia del reclutador:** validar edición inglesa y marcadores; realizar pruebas de consulta/descarga por identificador, mejorar confianza y copy.
4. **Back office productivo:** integraciones reales de Zoho Mail, notificaciones nuevas y reuniones con enlace/calendar; conservar confirmación explícita.
5. **Resiliencia:** rate limiting, auditoría documental, versionado/reversión de PDFs, monitor de errores, pruebas de accesibilidad y carga.

**Regla de gobierno:** una sola fuente vigente (`admin/`, `empresa/`, `portafolio/`, `lang/`, `theme/` y Supabase); no crear agentes ni módulos nuevos para funcionalidades que pertenecen al mismo back office. Toda modificación nueva requiere estado EJECUTADO/VERIFICADO/A_EJECUTAR/NO_VERIFICADO.

## G. Iteración 2 — Diseño Web Aplicado 16.01 (24/11/2026)

**Metodología consultada:** [Skill Diseño Web Aplicado v1.0](https://docs.google.com/document/d/1PVtxQwZaINZb0MuWhBYj2m0_g4aZyyOt/edit). Esta es una copia `MIRROR_PORTABLE / NO_CANONICO`, usada como metodología sin sustituir el maestro `CGA_ADN_PRIVADO/16_ADN_Tecnico_Web/METODOLOGIA/16.01_SKILL_Diseno_Web_Aplicado.txt`. Modos aplicados: C (auditoría), D (UX), E (UI) y F (responsive), con separación entre diseño e implementación.

### Paleta oficial (autoridad: propietario del portafolio)

| Función de marca | Valor oficial |
|---|---|
| Blanco | `#D7D7D5` |
| Negro | `#161616` |
| Cian | `#09B3DC` |
| Rosa | `#E5007D` |
| Amarillo | `#F6DB0E` |

**Regla visual:** `theme/theme.css` define `--brand-white`, `--brand-black`, `--brand-cyan`, `--brand-pink`, `--brand-yellow`, `--brand-gradient` como fuente única de tokens. `theme/modern.css` define superficies neutras y estilos de componentes para claro y oscuro, sin introducir nuevos colores de marca; `theme/icons.svg` contiene 32 símbolos funcionales de líneas; `theme/modern.js` los inserta sin CDN. Degradado cian-rosa-amarillo **solo para acentos finos** (no fondos extensos). No confundir verde/rojo semántico histórico con colores de marca.

**Accesibilidad de color:** contraste observado de rosa `#E5007D` con negro `#161616`: 3,99:1; con blanco oficial `#D7D7D5`: 3,15:1. No usar rosa como color de texto pequeño ni sobre blanco ni sobre negro. Para lectura usar negro/blanco; para acciones de modo oscuro usar cian/negro (7,32:1) y para modo claro negro/blanco (12,56:1).

### Handoff diseño → implementación (mismo repositorio, sin nuevos agentes)

| Área | Antes | Decisión ejecutada | Criterio / pendiente |
|---|---|---|---|
| Acceso / | Presentación redundante repetida en dos idiomas | Mantener elección ES/EN en tarjetas; quitar párrafos repetidos; usar gradiente oficial como acento | PRUEBA_PENDIENTE: pantallas móviles |
| Lector /portafolio | Modal extenso con lista de identificadores en párrafo y label | Título, ayuda corta, label sencillo y CTA `Ver CV y vacantes` con icono | Identificador sigue global, sin fijar 11 dígitos |
| Portal /empresa | Formularios con explicaciones redundantes | Dos propuestas visibles con iconos; descripción breve; CTA `Enviar propuesta`; búsqueda y filtros conservados | Mantener preferencia de contacto; PRUEBA_PENDIENTE |
| Administración | Navegación de texto y carga de CV visible antes de la lista | Pestañas con iconos; lista prioritaria; CTA `Nuevo CV` que despliega formulario solo bajo demanda; búsqueda | No alterar autorización de cuenta única ni backend |
| CV existentes | Lista con múltiples botones ambiguos | Iconos con texto: `Ver PDF`, `Editar`, `Activar/Desactivar`, `Eliminar`; estado vacío con CTA | Validar acciones con CV reales |
| Portafolios públicos | Dos formularios de carga visibles siempre | Tarjetas ES/EN, `Ver PDF` y `Publicar/Reemplazar PDF` que despliegan carga solo al solicitarla | Confirmación de reemplazo y respaldo permanecen |
| Solicitudes privadas | Acciones dispersas y listado sin búsqueda | Búsqueda inmediata, títulos de pasos cortos, acciones `Avanzar/Rechazar`, `Correo (Zoho)`, `WhatsApp` con iconos | Confirmación de envío sigue manual; no prometer despacho directo |
| Temas | Paleta aproximada rosa `#DF3E89` y amarillo `#FCD200` | Paleta exacta oficial compartida y estilos de foco/contraste | Pruebas visuales reales en claro/oscuro pendientes |

**Seguridad preservada:** solo una cuenta admin autorizada por UUID y correo verificado; ninguna ruta se convirtió en registro público; CV continúan con bucket privado y RLS. **No se implementó envío directo Zoho**, ni MFA, ni nuevos usuarios, ni modificaciones en permisos mediante esta iteración.

**Estados:** EJECUTADO = archivos versionados y código editado; VERIFICADO = sintaxis JS e ID/asset estático, no pruebas de producción; NO_VERIFICADO = experiencia real en navegadores, lectores de pantalla, PDF internacional, Outlook/Zoho y flujos E2E. El mirror de skill se dejó intacto.

### Próximas validaciones de usabilidad

1. **Titular:** acceder con única cuenta → cambiar 4 pestañas → `Nuevo CV` abre/cierra correctamente → buscar/gestionar CV → publicar/editar portafolio ES/EN.
2. **Reclutador:** idioma inglés/español → identificador internacional → encontrar vacante → descargar PDF → propuesta In-house o proyecto con mínimos campos.
3. **Móvil/contraste:** probar 320, 375, 430, 768, 1440 px; claro/oscuro, teclado, zoom 200%, foco visible; contraste AA de texto e íconos significativos.



## Ajustes UX del 24/11/2026 — correo, horarios, portal internacional y PDF inglés

- **CRM / solicitud aceptada:** editar el asunto y el mensaje **antes** de abrir el proveedor. Botones explícitos **Zoho Mail**, **Gmail** y **WhatsApp**. Zoho emplea `mailto:` y depende del controlador predeterminado de correo; Gmail abre su página de composición con asunto/cuerpo; ninguno envía automáticamente ni adjunta PDF sin intervención. La descarga del PDF desde el paso CV sigue disponible.
- **Confirmación:** los controles de envío son switches accesibles con `role="switch"`, apagados inicialmente y mostrados tras abrir el borrador; al activarlos requieren confirmación de que el envío ocurrió realmente. La confirmación y su reversión se guardan en `email_sent_at` / `whatsapp_sent_at` y el historial de `portfolio_cv_lead_activities`. Nunca afirmar envío solo por abrir el proveedor.
- **Reunión:** fecha + selector de hora 00–23 y minutos **00, 05, 10, …, 55**. Se normaliza a fecha local del navegador antes de guardar el ISO UTC existente en `meeting_at`.
- **Menú de descarga:** «Ver Curriculum Vitae (CV)» reemplaza «Acceder a CV por empresa». Se conserva el formulario por identificador, sin 11 dígitos obligatorios.
- **Empresa sin CV:** solo tras un resultado `not_found` del servicio, se abre un diálogo con **Continuar / Modificar identificador de empresa / Volver al portafolio**. No se afirma que nunca existió una solicitud: solo que no hay CV disponible. La edición acepta ID internacional de hasta 64 caracteres. Regreso y cambios incluyen `?lang=en|es`, y el selector de idioma del encabezado permanece visible.
- **PDF inglés:** antes `sections:null` ocultaba los enlaces. El lector vuelve a mostrar las cinco opciones y detecta destinos desde los marcadores y títulos de **su propio PDF**. Como respaldo temporal para la edición inglesa actual de 55 páginas, utiliza un mapa provisional, que se reemplaza por los títulos localizados en el archivo. **NO_VERIFICADO**: destino exacto de todas las secciones hasta revisar el PDF inglés real manualmente.
- **VERIFICADO:** rutas, validación estática del JavaScript, selectores de minutos, orden del editor y canales, traducciones i18n y caché del repositorio.
- **NO_VERIFICADO:** ejecución E2E en navegador con la cuenta de Zoho local, envío efectivo desde Gmail/WhatsApp, paginación inglesa definitiva y compatibilidad de calendario/diálogo en diferentes navegadores.


## CGA Glass Forms — extensión transversal (2026-11-25, Lima)

Decisión del titular: la estética aprobada para la consulta de CV debe aplicarse a todos los formularios del sitio, no solo al piloto. Base inspeccionada: `a863a77088aedb0a0338983997232da49d700131`. Se reutiliza `theme/modern.css` y sus tokens; las clases opt-in se aplican a `empresa/index.html`, `admin/index.html` y `portafolio/index.html`. Los controles CRM generados por `admin/solicitudes.js` y `admin/panel.js` quedan dentro de ámbitos CSS explícitos sin modificar su JS. Se excluyen campos ocultos, honeypot, radios/checkboxes de las reglas de altura de campos, botones de navegación ajenos y acciones de decisión sensibles de los cambios cromáticos. HOME y video no contienen formularios; `/portfolio/` y `/mensaje/` redirigen. Se mantienen iconos existentes y controles nativos, sin imponer iconos nuevos a todos los campos. Carga visual ligada a submit deshabilitado en handlers asíncronos inspeccionados; no equivale a envío confirmado. QA visual y funcional, móvil, temas, idiomas, y producción: pendientes; no se modifica backend, Auth, RLS, datos, i18n ni comunicaciones. Reversión: descartar rama o revertir commit antes/después del merge según corresponda.


### Iteración de detalle — 26/11/2026 (UTC)

Se corrige el selector hover (antes aplicaba también en reposo), se integran iconos SVG locales en los campos de texto y notas con asociación `label[for]` y en las etiquetas de controles nativos, se conserva el visor compacto y las búsquedas con iconos existentes, se añade feedback de procesamiento a acciones CRM explícitamente asíncronas, se restaura el icono de botones cuyo texto cambia y se añade transición discreta de cierre. Se preservan Auth, RLS, almacenamiento, destinatarios, datos y eventos de negocio; solo se cambia presentación y atributos ARIA de estado. QA parcial: 120 configuraciones de componentes aislados en Chromium local con 320/390/768/1440 px, ambos temas, variantes públicas ES/EN y admin ES; verificadas identidad de controles, asociación de etiquetas, no duplicación de iconos, padding, foco y ausencia de desbordamiento en fixtures. No son pruebas de páginas completas ni E2E. El administrador no incluye i18n en el código actual; no se agrega traducción sin alcance específico. QA real del sitio, CRM autenticado y publicación: pendientes. Reversión: descartar PR #1 o revertir sus commits si se integra.


### Corrección responsive posterior a publicación — 26/11/2026

Evidencia: tres capturas móviles aportadas por el titular. Se amplía el criterio de activación de barras laterales para dispositivos táctiles y ventanas apaisadas compactas; se reduce reserva lateral del pliego respetando su proporción; diálogo CV limitado a VisualViewport y con desplazamiento nativo, sin autofocus de teclado en táctiles; barra de carga indeterminada en descarga, preparación, render clásico y páginas visibles de revista aún sin caché (no durante precarga de vecinos ni al mostrar error); confirmación y video ocupan ancho disponible en vertical y margen superior al desplazarse. Se mantiene el orden confirmación → video → accesos. No se cambia PDF, Auth, RLS, almacenamiento ni envío de propuestas. Validación estática y pruebas de lógica puntuales; QA en Android/iOS real y publicación pendientes. Reversión: descartar PR o revertir su commit.

Las flechas de navegación se conservan en la barra izquierda (controles ya existentes), sin superponerlas al PDF. Cambios de tamaño sin cambio de modo no cierran menús. Se comprueba el código de referencia, no se afirma una prueba en navegador.


### Restauración de controles aprobados y continuidad visual HOME — 26/11/2026

La evidencia móvil del titular confirma la pérdida visual de flechas laterales y lupa, causada por reglas introducidas en el PR #2. Se retiran esas reglas, se recuperan los chevrons animados originales con sus IDs/eventos y el SVG de zoom +/−, se reservan 48 px para evitar tapar el pliego y se ocultan duplicados del rail. Las tarjetas de agradecimiento de /empresa/ y /video/ comparten las reglas glass originales de HOME (incluido brillo por tema, focus y press), conservando layout, enlaces, idiomas y botones de contacto. No se revierten otros cambios del PR #2. Validación estática, pendiente prueba visual real y autorización de publicación.


### Índice lateral y paginación superior (escritorio) — 26/11/2026

Solicitud del titular: mover exclusivamente los capítulos de la barra inferior a un índice plegable izquierdo y Anterior/Página/total/Siguiente a la parte superior. Se reutilizan los nodos de navegación existentes sin duplicarlos; el panel compacto mide 48 px, con control accesible de expansión, y se recalcula el pliego al compactar/expandir. El modo se aplica desde 1000 px con puntero fino y hover, respetando el modo apaisado móvil prioritario y la navegación vertical original. Se conserva el tema y las traducciones ES/EN; no se modifica el PDF ni se altera la lógica de navegación. Cambios incorporados al PR #3 abierto. Validación estática; pendiente verificación visual y autorización de producción.


### Indicador central de descarga del lector — 26/11/2026

Se reemplaza el aviso visual central de descarga/preparación por la barra existente cian–rosa, centrada durante el arranque. Se muestra porcentaje basado en bytes recibidos si existe Content-Length utilizable y lectura por stream; si no, barra indeterminada sin inventar porcentajes. El indicador superior se conserva únicamente para cambios de páginas; el mensaje de error permanece visible. El PDF se descarga una sola vez, preservando URL, no-store, validación de firma y fallback. Pendiente prueba visual en producción y autorización de publicación.


### Paginación compacta en una sola barra de escritorio — 26/11/2026

Solicitud: eliminar segunda fila superior y textos visibles Anterior/Página/de/Siguiente. El formulario original se mueve dentro de .readerTools; las flechas SVG reutilizan los estilos de los iconos del visor (30×30 px), número editable de 42×30 px y separador /. Se conservan etiquetas accesibles, títulos ES/EN, IDs, listeners, estado disabled y enlaces de capítulos. En móvil se mantiene la distribución anterior y su texto, sin duplicar controles. Validación estática; pendiente QA visual y publicación autorizada.


### Control único de vista revista — 26/11/2026

Solicitud del titular: retirar el botón redundante Visor PDF clásico. Se elimina su nodo, listener y reglas CSS del visor. El botón original Vista revista / Salir de revista conserva la alternancia, estado activo, rótulo ES/EN y recuperación del modo clásico al salir. Se conserva el fallback PDF nativo ante error y se desactiva el botón cuando no existe documento avanzado disponible. Sin cambios de PDF, backend ni restantes controles. Validación estática; publicación pendiente de autorización.


### CTA de propuestas — acabado Glass HOME (26/11/2026)

Se reemplaza el relleno sólido del botón Enviar invitación / Proponer proyecto por el mismo conjunto de reglas Glass de las tarjetas de idiomas, con acento de tema en interacción, borde suave, blur, reflejo y animaciones. Se mantiene el icono de envío, etiqueta dinámica ES/EN, ancho móvil, estados disabled, formulario y verificación de seguridad. Cambio visual localizado en #submitLead, sin alterar el flujo de envío. Validación estática; pendiente QA visual y autorización de producción.


### Microinteracciones CV y acceso HOME (26/11/2026)

Autorización explícita del titular para mejoras anteriores y actuales. Se incorporan al PR #7: tarjetas de vacantes con entrada y elevación discreta, badge con shimmer de una sola pasada (sin animación perpetua), botón Descargar CV reutilizando Glass HOME con icono local y estado busy real, filtros con contraste activo y feedback de pulsación, contador con transición breve. El nombre del titular en /empresa/ (incluido estado de confirmación) y /video/ es un enlace al HOME, con tipografía de 15 px (+1 px). Se preservan IDs de botones, validación, endpoints, datos, permisos e idiomas; no se modifican backend ni PDF. Validación estática y revisión de diferencias; QA visual real pendiente.


### Auditoría de regresión visual /video/ y confirmación de /empresa/ — 26/11/2026

Evidencia: capturas del titular de /video/ con nombre subrayado y cuatro CTA sin superficie Glass; GitHub Pages confirmó éxito del commit 76a4321. Causa comprobada en fuente: /video/ enlazaba modern.css pero no incluía modern.js ni la clase raíz cgaModern, por lo que los selectores de HOME y la identidad no coincidían. HOME, /empresa/, /admin/ y /portafolio/ sí cargaban modern.js. Las rutas /portfolio/ y /mensaje/ redirigen a las correspondientes rutas canónicas. Se corrige activación declarativa cgaModern en las cinco páginas reales, se unifica versión de caché de modern.css y modern.js, se incluye el inicializador en /video/, se iguala el subtítulo Portafolio/Portfolio y la tipografía del encabezado, y se corrige selector de animación de flecha de las tarjetas de idioma en ambas vistas de agradecimiento. Enlaces a HOME, revista ES/EN y contactos conservados. La confirmación de /empresa/ usa los mismos IDs/clases, revela acciones tras éxito y conserva su lógica de envío. No se envía ninguna propuesta de prueba ni se modifican datos, Auth, RLS o PDF. Validación estática de contratos y rutas; publicación y QA real pendientes. Reversión: descartar PR o revertir su commit.

QA adicional: Chromium local con fixture aislado basado en los selectores y declaraciones de las hojas compartidas: se reprodujo fondo none/borde 0 px sin cgaModern; al activarla pasaron 32 combinaciones (video/confirmación × dark/light × ES/EN × 320/390/768/1440 px) con cuatro CTA por caso, gradiente, borde 1 px, blur 18 px, identidad 15 px sin subrayado, enlace HOME y sin overflow horizontal. No equivale a cargar páginas completas, ni a probar video, backend, envío, navegación real o producción.


### Segunda iteración CRM y UI — 26/11/2026

Se reemplazan confirm/prompt nativos del admin por un diálogo accesible compartido con CGA Glass, cancelación segura, copia manual y edición. Se agregan filtros avanzados de tipo, etapa, modalidad, antigüedad, correo confirmado (registro manual), reunión y orden; se combinan con búsqueda y pestañas existentes en las últimas 200 solicitudes. Se corrige ejemplo de cargo a Gerente de Marketing / Marketing Manager. Se propone y aplica en rama de revisión el dorado UI #D6B84B, preservando amarillo de marca #F6DB0E y el PDF; se elimina regla contradictoria de filtro sólido. No se modifica base de datos, correo, permisos, archivos PDF ni se publica. Pendientes: envío manual registrado, acceso privado a solicitudes por verificación de titularidad y doble edición A4/A3. Validación estática y QA real pendiente.


### Separación de ediciones públicas del portafolio — 26/11/2026

Se preparan cuatro slots independientes (ES/EN × A4 web/A3 descarga) conservando los dos nombres de A4 ya utilizados. Nuevas rutas A3: Christian_Arleo_Portafolio_ES_A3.pdf y Christian_Arleo_Portfolio_EN_A3.pdf. Se comprueba disponibilidad A3 mediante HEAD antes de ofrecer la descarga; si no está disponible, el A4 validado se identifica explícitamente como edición de lectura. Impresión y revista conservan A4. Las nuevas opciones de administración reutilizan el upload y las comprobaciones existentes. No se han cargado los PDF A3, no se ha verificado Storage/RLS para los nuevos nombres y no se afirma que los documentos existentes sean dimensionalmente A4 sin inspección. Pendiente autorización de publicación, validación de permisos y archivos reales. No se tocan CV personalizados por empresa.


### Decisión cromática aprobada — 26/11/2026

El titular confirma que sus referencias amarillas son #F6C928, #FDD500 y #FCD406 y aprueba #F6C928 como acento UI Premium Glass. Sustituye la propuesta provisional #D6B84B de la rama no publicada. Se conservan el contraste del foco #806600, las mezclas translúcidas, los degradados de marca existentes y los PDF. Se actualiza la referencia de caché de theme.css en las cinco páginas reales. Aprobación cromática registrada; integración y publicación del PR completo pendientes de autorización expresa.


### Portal privado: Mis solicitudes (26/11/2026)

Se prepara historial real de solicitudes por correo verificado + identificador empresarial; no se amplía resolve público. Enlace HMAC de 24 h enviado al correo almacenado, token en fragmento retirado del URL y sesión de navegador, alcance vinculado a correo/RUC. Consulta de campos permitidos, estados públicos pendiente/en revisión/contactada/cerrada, sin motivo interno, teléfonos, correos ni información de otros contactos. Formulario repetido compacto tras verificar historial o recibir confirmación en sesión. ES/EN y estilos compartidos. No se modificó base de datos, ni se envió correo real.

Bloqueo de producción: configurar PORTFOLIO_REQUEST_HISTORY_SECRET aleatorio (mínimo 32 caracteres, nunca en Git), provisionar RPC reserve_portfolio_history_email(recipient_key text) → boolean exclusivo service_role, con reserva atómica por destinatario (1/hora, 3/día) y global (10/hora, 30/día), sin correo en claro. La función falla cerrada si falta RPC/secreto. Pendiente verificar permisos y realizar QA en Supabase/navegador: expiración, token alterado, cruce correo/RUC, límites, registro existente, confirmación de nuevo envío, ES/EN, móvil. No publicar frontend/backend hasta resolver bloqueos y recibir autorización. Reversión: revertir PR y mantener resolve previo.


### Aprobación funcional y preparación de seguridad del historial — 26/11/2026

El titular aprueba el flujo de Mis solicitudes. Se incorpora SQL de revisión para la reserva atómica de correo, con esquema privado, RLS, SECURITY INVOKER, ejecución RPC restringida a service_role, límites por destinatario y globales, y borrado de reservas de más de 24 h en cada consulta. Se añade prueba transaccional para staging, no ejecutada. El cierre de acceso elimina también los datos de la confirmación local en pantalla. No se aplicó SQL ni se cambió Auth, RLS existente o secretos; no se desplegó Edge Function. El secreto PORTFOLIO_REQUEST_HISTORY_SECRET requiere configuración segura en el Dashboard; no debe transmitirse por chat o Git. Pendiente autorización explícita de cambios backend y producción, pruebas en staging y verificación de proveedor de correo. El CLI y PostgreSQL local no están disponibles; los scripts son propuestas de despliegue, no migraciones ejecutadas.


### Autorización de seguridad y ejecución parcial — 26/11/2026

El titular autoriza explícitamente cambios de seguridad y producción condicionada a pruebas. Se verifica que esquema/RPC no existían. Se ejecuta DDL y pruebas SQL en una transacción revertida en el proyecto de portafolio (sin staging independiente): límite horario por destinatario y global, límites diarios, caducidad de reservas, rechazo de clave inválida y permisos. Resultado positivo; rollback comprobado. Se aplica migración registrada portfolio_request_history_rate_limit. Verificación posterior: RLS activo, esquema privado, RPC exclusivo service_role, SECURITY INVOKER, 0 reservas. Advisor INFO sin políticas en tabla privada es intencional; WARN de protección de contraseñas filtradas es ajeno al cambio y no se modifica Auth. No se modifica ninguna solicitud existente ni se envía correo de prueba. No se verifica concurrencia real ni flujo extremo a extremo. Bloqueo: conector Supabase no ofrece gestión de secretos de Edge Functions; titular debe crear PORTFOLIO_REQUEST_HISTORY_SECRET mediante Dashboard con valor criptográfico aleatorio, sin compartirlo por chat. No se despliega Edge Function ni se fusiona PR #10 hasta completar verificación; autorización ya registrada. El acceso privado permanece no publicado.


### Configuración del secreto y QA criptográfico — 26/11/2026

El titular confirma haber guardado el secreto en Supabase, sin compartir su valor. Verificación SQL posterior: RLS y RPC service_role-only activos, 0 reservas. Edge Function activa coincide exactamente con fuente de main y verify_jwt=false preexistente. Se reproducen las funciones de firma/verificación en Node WebCrypto con datos sintéticos: 8 aserciones pasan (firma, vinculación RUC/correo, manipulación, formato, vencimiento y ámbito). Se añade acción request_history_check, sin acceso a registros ni envío de correo, que solo devuelve ready/unavailable y comprueba el secreto real y disponibilidad de configuración de Resend; no retorna claves, tokens ni datos. Pendiente ejecución real del diagnóstico, prueba de entrega y flujo navegador; navegador conectado no disponible. Autorización de seguridad y producción condicionada registrada previamente.


### Despliegue backend para prueba de readiness — 26/11/2026

Edge Function portfolio-cv-portal v16 ACTIVE desplegada con autorización previa, conservando verify_jwt=false y deno.json preexistentes. Fuente remota cotejada con commit b920ba7. Frontend permanece sin fusionar: falta ejecutar request_history_check (POST JSON, respuesta ready), verificar entrega de correo y navegación real. No se consultaron solicitudes privadas ni se enviaron correos durante este despliegue. El diagnóstico no altera datos ni devuelve el secreto. Reversión backend: redeploy de la fuente index.ts de main 6da9949 con el mismo deno.json si se detecta regresión.


### Readiness confirmado por el titular — 26/11/2026

El titular ejecutó POST request_history_check en el panel de Supabase y aportó captura con status ready. La función real confirma presencia de configuración de correo, firma/verificación HMAC, rechazo de token manipulado/vencido y separación de correo/RUC con datos sintéticos. No comprueba entrega efectiva de correo ni la experiencia completa. Se habilita la interfaz como piloto autorizado para poder realizar la prueba final desde el portal con correo propio del titular y solicitud existente de prueba; no se envían correos desde esta sesión. No se considera cierre funcional hasta verificar entrega, acceso e historial, plegado de formulario y cierre de acceso.


### CRM Mail — fase 1, envío sin suscripción adicional (26/11/2026)

Autorización del titular para avanzar con infraestructura gratuita. Se prepara en rama independiente una función portfolio-crm-mail, JWT de usuario verificado y membresía de administrador + correo aprobado; destinatario tomado únicamente de la solicitud, preferencias de contacto y decisión revalidadas en servidor. Se exige remitente hola@christianarleo.com configurado (sin fallback silencioso), usa Resend existente. Tabla de mensajes con lectura RLS solo administradores, escritura service_role, reserva atómica, 10 intentos por 24h, idempotencia, protección de duplicados y bloqueo temporal de resultado incierto; borrado de solicitud elimina sus mensajes por FK. Estados aceptado por proveedor, fallido, incierto y pendiente; aceptación no equivale a entrega. UI de envío explícitamente confirmado y consulta del cuerpo por solicitud, conserva proveedores externos como alternativa. Sin adjuntos, recepción, sincronización de Zoho o verificación de cuota comercial; no se crea suscripción, no se aplica SQL ni se envía correo. Pendiente revisar esquema con pruebas transaccionales, confirmar remitente y cuota, autorizar seguridad/producción y probar envío a correo propio. La recepción dependerá de capacidades gratuitas verificadas de Zoho o alternativa sin modificar MX.

QA inicial SQL: DDL, RLS, ausencia de permisos de escritura para authenticated, ausencia de EXECUTE RPC para anon/authenticated y rechazo de solicitud inexistente verificados en transacción revertida. Rollback comprobado (tabla y RPC ausentes). No equivale a pruebas de envío, concurrencia o acceso real de usuario. Se requiere confirmación de remitente y límite del proveedor, pruebas de consentimiento, duplicado, límite diario y resultado ambiguo antes de uso operativo. No se modificó producción.


### CRM Mail: autorización y validación SQL — 26/11/2026

El titular autoriza seguridad, configuración y publicación condicionada. Pruebas SQL en una transacción revertida: administrador inexistente, consentimiento bloqueado, decisión incompatible, reserva con destinatario obtenido de la solicitud, idempotencia, intento pendiente, duplicado y límite de 10 intentos por 24 h, con datos de prueba y correo example.invalid. Resultado positivo; no se realizó envío. Se añade interruptor independiente PORTFOLIO_CRM_MAIL_ENABLED (true solo tras verificar dominio y plan de Resend). Remitente fijo hola@christianarleo.com; no se altera PORTFOLIO_FROM_EMAIL ni los correos automáticos anteriores. La función no reserva ni envía cuando falta configuración. Recepción y adjuntos siguen pendientes. Plan/cuota actuales no verificables mediante conector; el titular debe comprobarlos en el panel de Resend.


Migración portfolio_crm_mail_outbound aplicada con autorización expresa después de verificar rollback. Estado posterior: RLS activo, escritura restringida, RPC exclusivo service_role, cero mensajes; advisors sin hallazgos nuevos (advertencia Auth preexistente ajena al cambio). Edge Function portfolio-crm-mail v1 ACTIVE, verify_jwt=true, fuente cotejada con commit 23f963c. Gate PORTFOLIO_CRM_MAIL_ENABLED debe quedar sin activar hasta confirmar dominio remitente y plan gratuito. No se consulta valor de secretos, no se envían mensajes ni se modifica Zoho/DNS. Frontend PR #11 sin fusionar, pendiente de verificación del proveedor y prueba real de administrador. Reversión preferida: mantener gate deshabilitado; conservar historial y no eliminar tabla.


### Configuración Resend y piloto CRM Mail — 26/11/2026

Evidencia aportada por el titular: Resend Transactional 3.000 correos/mes, USD 0, sin método de pago; dominio principal christianarleo.com y subdominio de notificaciones verificados, DKIM y CNAME de envío verificados, recepción Resend desactivada. API Key existente con Sending access / All domains. Titular confirma guardado de PORTFOLIO_CRM_MAIL_ENABLED=true en Supabase, sin compartir claves. Backend ACTIVE v2, verify_jwt=true y fuente cotejada; RLS activo, escritura restringida, RPC exclusivo service_role, cero registros de envío. Se integra interfaz como piloto autorizado para probar envío manual a correo propio asociado a una solicitud de prueba; aceptación por Resend no equivale a entrega. No se envía correo desde esta sesión; no se confirma ejecución real del gate, entrega, navegador ni recepción Zoho. Mantener límite CRM 10 intentos/24 h (no constituye un límite agregado de todos los servicios). Ninguna suscripción nueva. Reversión inmediata: deshabilitar PORTFOLIO_CRM_MAIL_ENABLED, conservar historial.


### Corrección CRM Mail 403 — 26/11/2026

Evidencia del titular en Resend: POST /emails HTTP 403, API Key CGA_PORTAFOLIO_NOTIFICATIONS no autorizada para christianarleo.com. Dos intentos previos fallidos sin provider_id ni accepted_at. Titular confirma creación de clave de envío específica para el dominio principal y secreto RESEND_CRM_API_KEY. Se sustituye exclusivamente la referencia del CRM por dicho secreto, sin fallback ni modificación de RESEND_API_KEY del portal. Se registra código HTTP numérico o fallo de red en logs y actividad existente del lead; se muestra diagnóstico seguro en Admin, sin respuesta cruda del proveedor, destinatarios, claves o cuerpo en logs. No se alteran RLS, cuotas, MX, datos existentes ni se reenvían mensajes automáticamente. Pendiente prueba de entrega a correo propio.


### CRM Mail UX — 26/11/2026

Aprobación del titular para retirar flujo manual heredado. Evidencia aportada: correo de prueba recibido desde hola@christianarleo.com. Se elimina copiar destinatario/asunto/mensaje y Zoho/Gmail en los dos compositores y el interruptor manual de correo/rechazo; WhatsApp conserva su flujo. La tabla portfolio_crm_mail (aceptado) es la fuente principal para estado, filtro y señales de bandeja, con consulta paginada de metadata; confirmaciones históricas se preservan y distinguen. Estado e historial quedan visibles independientemente del editor. Toast Correo enviado con check SVG, animación breve, cierre a 4 s y prefers-reduced-motion. Detalle técnico de aceptación, no entrega verificada, permanece en historial. Sin modificación de Supabase, permisos, proveedor, notificaciones ni envíos reales. QA estática; navegador pendiente. PR independiente para revisión/publicación.


### CRM Mail Inbound — piloto autorizado (26/11/2026)

Titular confirma Resend Free 3.000 transaccionales/mes, 100/día, 3/3 dominios; sin cargos previstos con pay-as-you-go deshabilitado. Subdominio respuestas verificado. Endpoint aislado, HMAC Svix, ventana de 5 min, límites de tamaño, firma obligatoria sin JWT de Supabase. Ruta aleatoria asignada a cada envío aceptado y coincidencia con remitente registrado, sin afirmar identidad verificada. Solo texto plano, deduplicación por ID proveedor. RLS admins, escritura service_role y marca leído por admin. Reply-to anterior se conserva hasta activar gate tras QA. Conversación y filtro de no leídos dentro de Solicitudes; sin bandeja independiente, notificación en vivo, adjuntos ni sincronización de Zoho. Correos antiguos siguen respondiendo a Zoho. API y formato real de Resend pendientes de comprobar; no publicar hasta pruebas. Reversión: deshabilitar gate, mantener recepción de rutas emitidas y conservar historial.
