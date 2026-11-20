# House Money: colores de marca (regla 60-30-10)

Actualizado el 17/11/2026: **tema claro, minimalista, con acento rojizo; el 60 % y el 30 % vienen de otras familias de color** (pedido de Jairo), más una textura de "sol" difuminado inspirada en la referencia de capas con blur (fondo `#260600`). Reemplaza la paleta oscura "Night Vault", que queda al final como alternativa descartada.

## Paleta "Paper, Navy & Ember"

| Rol | % | Nombre | Hex | Dónde se usa |
|---|---|---|---|---|
| **Base** | **60 %** | Paper (neutro cálido) | `#F5F3EE` | Fondo de la app |
| | | Card | `#FFFFFC` | Tarjetas (con sombra suave, sin bordes gruesos) |
| **Estructura** | **30 %** | Navy (azul profundo, complemento del rojizo) | `#16233F` | Títulos, texto, la tarjeta del Vault, selección activa |
| | | Stone (gris frío) | `#E3E6EB` | Divisores, chips inactivos, barras vacías |
| | | Muted | `#5D677A` | Texto secundario |
| **Acento** | **10 %** | Ember (rojizo medio) | `#C4442E` | El botón principal, la racha, la barra de progreso, un dato clave por pantalla |
| | | Ember oscuro | `#9C3523` | El "borde 3D" del botón principal |
| | | Ember texto | `#B03B27` | Texto pequeño en rojizo (el Ember puro da 4,49:1 sobre Paper) |
| Textura (fuera de la regla) | — | Sol | `#E2441C` + `#FFD65C` difuminados | Solo dentro del Vault navy y del hero del onboarding: un "amanecer" |
| Funcional (fuera de la regla) | — | Gain | `#2E7D50` | Solo en cifras de ganancia |

### Contrastes verificados (WCAG)

| Combinación | Contraste | ¿Pasa? |
|---|---|---|
| Navy sobre Paper | 14,07 | Sí |
| Muted sobre Paper | 5,14 | Sí |
| Muted sobre Card | 5,69 | Sí |
| Texto blanco sobre Ember (botón principal) | 4,98 | Sí |
| Ember sobre Paper | 4,49 | Solo texto grande; el texto pequeño usa Ember texto `#B03B27` |
| Paper sobre Navy (tarjeta del Vault) | 14,07 | Sí |
| Gain sobre Card | 5,00 | Sí |

Descarté otros rojizos más claros (`#D9573B`: 3,91; `#C65A3E`: 4,26) porque el texto blanco no llegaba a 4,5:1.

## Cómo se ve la proporción

```
████████████████████████████████████████████████████████████  60 %  Paper / Card (aire, fondo)
██████████████████████████████                                30 %  Navy / Stone (texto, Vault, estructura)
██████████                                                    10 %  Ember (un solo foco por pantalla)
```

Regla: **un solo elemento Ember grande por pantalla** (el siguiente paso). Es lo que hace intuitivo a Duolingo: siempre sabes qué tocar.

## Estilo: minimal + toque Duolingo + cristal sutil

| Elemento | Regla |
|---|---|
| Tipografía | Nunito, pesos 600-800; números grandes en 800 |
| Botón principal | Ember, esquinas 16 px, borde 3D sutil de 3 px (Ember oscuro); al tocarlo baja |
| Tarjetas | Card blanca, sombra muy suave, sin bordes; el Vault es la única tarjeta Navy, con el "sol" difuminado saliendo por una esquina |
| Cristal y glow | Barra inferior translúcida con blur; el único glow es la textura de sol (capas difuminadas, como la referencia) |
| Color | Sin degradados. Ganancias en Gain, pérdidas en Navy con signo "−" (el rojo no significa pérdida: es la marca) |
| Movimiento | Entradas suaves de 200 ms; confeti mínimo (Ember + Navy) solo al ganar |

## Alternativa descartada: "Night Vault" (oscura)

Fondo `#0E0B1F`, violeta `#7B5CFF` y lima `#C6F35C`. Se descartó a pedido: se prefirió tema claro, más minimalista y con acento rojizo.
