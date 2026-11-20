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
- El repo `jairoamayac/ubc-hackathon` es público, y la bitácora completa incluye la dirección del Airbnb, gastos en dólares y compras de la familia. Por eso a GitHub y a la carpeta compartida del vault se subió solo un extracto (secciones del 20/11, reglas y pendientes de branding y front). La bitácora completa queda únicamente en este Project.
- Drive, carpeta "PROJECT VAULT — UBC Hackathon 2026" (archivos nuevos, no se tocó ninguno existente): "Bitácora UBC, hackathon y branding.md" (extracto) y "Frontend log de Kept.md" (copia de `docs/frontend-log.md`). El kit v0.2 ya estaba subido.
- GitHub, rama `feat/kept-frontend` (no `main`): se agregaron `docs/branding-kit-agentes.md` (kit v0.2) y `docs/bitacora-ubc.md` (extracto). `docs/frontend-log.md` ya estaba.
- No se publicó nada en X, no se gastó dinero, no se tocaron permisos ni el programa de Solana.

## Reglas que respeté
- Hechos, hipótesis y opiniones van separados y marcados.
- Ninguna idea de producto figura como elegida salvo la que Jairo y el equipo ya documentaron en el repo (Kept, antes Burn the Boats).
- Nada irreversible sin aprobación de Josué.
- No se guardan datos sensibles (pasaporte, wallet completa) en estos archivos.


## Pendientes abiertos (branding y front)
Para el branding: chequear dominio, usuario de X y Devpost para Kept, y dibujar el logo definitivo.
Para el front de Kept: que Josué revise y mergee la rama `feat/kept-frontend`, decidir 95/5 o 60/40, probar las pantallas en un navegador contra devnet y conectar la apelación a Grok Bot.
