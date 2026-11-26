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
