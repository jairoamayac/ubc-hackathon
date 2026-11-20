# Bitácora UBC, hackathon y branding (extracto)

Extracto público de la bitácora del equipo. Solo incluye lo del 20/11 sobre branding y front de Kept. La bitácora completa vive en el Project UBC de Martín.

## 2026-11-20 (Claude, sesión de Martín) branding y kit para agentes
- Trabajo de branding en el chat con Martín: ideas de nombre (Rubicon, Commit, Iacta, Kept, Pacta, Pinky, Plink y otras), paleta elegida ("Forest": papel #FAFAF7, tinta #1A1A18, verde bosque #1F5F4A, menta #DDEFE5, líneas #E6E4DD, sin naranja). Nombre y logo siguen PENDIENTES. No se eligió ninguna idea de producto.
- Creado: `claude/05-kit-branding-agentes.md` (kit de branding para agentes, versión 0.1, en inglés).
- Creado en Drive, dentro de la carpeta "PROJECT VAULT — UBC Hackathon 2026": "Kit de branding para agentes.md" (misma versión 0.1). Es un archivo nuevo, no se editó ni movió ningún archivo existente del vault, y no se actualizó el INDICE del vault.
- No se publicó nada en X, no se gastó dinero, no se tocó código ni permisos.

## 2026-11-20 (Claude, sesión de Martín) front de Kept en el repo de Jairo
- Leído (solo lectura): mails de Devpost y Luma en Gmail, para confirmar que las entregas cierran a las 12:00PM del viernes 20/11 (el mail no aclara zona horaria; el plan asume CST). Búsquedas en el vault de Drive para ubicar la carpeta y buscar archivos de Grok. No se escribió nada con esto.
- Repo `jairoamayac/ubc-hackathon`: al principio solo había lectura (la conexión de GitHub no tenía permiso). Se volvió a pedir el acceso con escritura y quedó adjunto a la sesión. Se leyeron README, AGENTS, docs (contexto, marca, decisiones, arquitectura v2) y los componentes del front.
- Hallazgo: el último commit de Jairo (`04d59c5`) ya traía la paleta Forest del kit, sin apuestas, metas propias, votación solo de participantes y reparto 95/5. Por eso solo se hizo lo que faltaba.
- Creada la rama `feat/kept-frontend` (commit `d61100b`) y subida al repo. No se tocó `main` y no se abrió ningún PR.
- Cambios en el front: nombre Kept (una sola constante), fuente única del reparto (FEE_PERCENT) y de los chips de monto, chips de $10, $20 y $50, resumen vivo de la consecuencia antes de confirmar, resultado con detalle por persona (dinero que entra, dinero que sale, comisión de la plataforma), nueva pantalla de apelación con captura y veredicto simulado "Reviewed by Grok" con motivos (marcada como Demo), dos textos sin la palabra wallet, README y `docs/frontend-log.md` con el detalle.
- Verificación: lint limpio; el build compila y pasa TypeScript en una copia temporal sin las fuentes de Google (este entorno no puede descargarlas; `layout.tsx` del repo no se modificó). No se abrió en un navegador ni se probó contra devnet.
- Discrepancia a resolver: el pedido de Martín decía reparto 60/40, pero el programa y los docs de `main` implementan 95/5, así que las pantallas dicen 95/5. Para cambiarlo hay que tocar `src/lib/brand.ts` y el `fee_bps` del programa a la vez (decide Josué).
- La apelación es una simulación: no sube nada, no cambia el resultado ni el dinero. Falta conectarla a la rutina real de Grok Bot.
- Código viejo de House Money (HouseMoneyApp y sus pantallas) no se borró; no lo usa `page.tsx`.
- Kit de branding actualizado a v0.2 con el nombre Kept y los hechos de producto: se reemplazó `claude/05-kit-branding-agentes.md` y en Drive se subió "Kit de branding para agentes v0.2.md". El conector de Drive no edita contenido, así que la v0.1 se renombró a "Kit de branding para agentes v0.1 (reemplazado por v0.2).md". No se borró nada y el INDICE del vault sigue sin actualizar.
- No se publicó nada en X, no se gastó dinero, no se tocaron permisos ni el programa de Solana.

## 2026-11-20 (Claude, sesión de Martín) subida de los .md a Drive y GitHub
- Pedido de Martín: subir los .md y la bitácora a Drive y a GitHub.
- El repo `jairoamayac/ubc-hackathon` es público y la bitácora completa tiene datos personales del viaje. Por eso a GitHub y a la carpeta compartida del vault se subió solo un extracto (secciones del 20/11, reglas y pendientes de branding y front). La bitácora completa queda únicamente en este Project.
- Drive, carpeta "PROJECT VAULT — UBC Hackathon 2026" (archivos nuevos, no se tocó ninguno existente): "Bitácora UBC, hackathon y branding.md" (extracto) y "Frontend log de Kept.md" (copia de `docs/frontend-log.md`). El kit v0.2 ya estaba subido.
- GitHub, rama `feat/kept-frontend` (no `main`): se agregaron `docs/branding-kit-agentes.md` (kit v0.2) y `docs/bitacora-ubc.md` (extracto). `docs/frontend-log.md` ya estaba.
- No se publicó nada en X, no se gastó dinero, no se tocaron permisos ni el programa de Solana.

## 2026-11-20 (Claude, sesión de Martín) segunda tanda del front: demo offline, monto sin chips, coach
- Pedido de Martín: seguir construyendo todo el front sin parar, con la spec técnica que está en Drive ("Kept: spec técnica, backlog y milestones", sección 13, decisiones de producto del 20/11).
- Leído en Drive (solo lectura): "Ideación Consumer Apps UBC" y la spec técnica. Ahí la sección 13 reemplaza los chips de $10, $20 y $50 y el 60/40 que se habían usado antes. Lo corregí.
- Rama `feat/kept-frontend` (commit `030640a` y los siguientes). No se tocó `main` ni se abrió PR.
- Nuevo `/demo`: recorrido de 75 segundos sin backend ni red, con las 10 pantallas, 5 personas con $50 cada una, pozo $250, Martin cobra $121,25 (comisión $7,50), disputa de Ben, apelación con Grok Bot por estados, 3 de 4 confirmaciones. Tecla D, "Play all" y reset. Todo simulado y rotulado.
- Monto sin chips ("How much would it hurt to lose?"), sugerencia de Grok, aviso debajo de $50 y confirmación extra arriba de 3 veces lo sugerido. Coach de metas medibles (reglas locales). Regla de reparto en un módulo puro con chequeo (`scripts/check-settlement.mts`).
- App real: la apelación muestra los mismos estados que el flujo de Grok Bot (simulados), banner de meta en riesgo con menos de 24 horas, link a `/demo` en el onboarding.
- Verificación: lint limpio, build en copia con fuentes stub (compila y prerenderiza `/` y `/demo`), chequeo del reparto, y recorrido de `/demo` en Chrome sin pantalla: sin errores de consola y sin las palabras wallet, seed, token ni 0x. No se probó la app real contra devnet ni en un teléfono.
- Documentado en `docs/frontend-log.md` (sección "Second pass") y README ("Try the demo").
- No se publicó nada en X, no se gastó dinero, no se tocaron permisos ni el programa de Solana.

## Reglas que respeté
- Hechos, hipótesis y opiniones van separados y marcados.
- Ninguna idea de producto figura como elegida salvo la que Jairo y el equipo ya documentaron en el repo (Kept, antes Burn the Boats).
- Nada irreversible sin aprobación de Josué.
- No se guardan datos sensibles (pasaporte, wallet completa) en estos archivos.


## Pendientes abiertos (branding y front)
Para el branding: chequear dominio, usuario de X y Devpost para Kept, y dibujar el logo definitivo.
Para el front de Kept: que Josué revise y mergee la rama `feat/kept-frontend`, probar la app real en un navegador contra devnet y en un teléfono, conectar la apelación al Grok Bot real (M7) y decidir lo abierto de la spec (rendimiento, abandonar antes, bloqueo por no votar).
