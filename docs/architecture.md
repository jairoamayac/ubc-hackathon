# House Money: arquitectura y flujos

17/11/2026. Hecho con la skill `arquitectura-de-software`: primero el diagnóstico, después el estilo; luego C4 por niveles y los patrones con sus 4 elementos (nombre, problema, solución, consecuencias).

## 1. Diagnóstico (antes de elegir patrones)

| Pregunta | Respuesta |
|---|---|
| ¿Qué es lo que **no puede fallar**? | La promesa "tu ahorro nunca se mueve". Tiene que ser una **regla del programa on-chain**, no del frontend ni del backend |
| ¿Qué cambia seguido? | La UI, los textos, los mercados disponibles, la fuente de precio (Pyth real vs. modo demo), los avisos |
| ¿Qué es estable? | Las reglas de dinero: depositar, separar interés, jugar con tope, liquidar, retirar |
| Equipo y plazo | 3-4 personas, 2,5 días |
| ¿Necesita microservicios o eventos? | **No.** La skill es explícita: con equipo chico y un solo despliegue, **monolito modular**. Los eventos solo aparecen en el borde (avisos), donde la consistencia eventual no importa |

**Decisión de estilo:** arquitectura en **capas** con dos niveles (cliente-servidor), más un programa on-chain que es la **única fuente de verdad del dinero**.

| Capa | Dónde vive | Responsabilidad |
|---|---|---|
| Presentación | Next.js (pantallas) | UI tipo juego, sin lógica de dinero |
| Aplicación | Next.js (`lib/house-money` + rutas `/api`) | Arma transacciones, paga el gas (relayer), recibe eventos |
| Dominio (reglas de dinero) | Programa Anchor `house_money` | Invariantes del Vault, jugadas, liquidación |
| Datos | Cuentas de Solana (PDAs) + Pyth | Estado y precios |

## 2. C4, nivel 1: contexto

```mermaid
flowchart LR
    U["Usuario<br/>(Gen Z en EE. UU.)"] -->|"usa en el celular"| HM["House Money<br/>(app de ahorro con jugadas semanales)"]
    F["Amigos de la liga"] -->|"compiten en el ranking"| HM
    HM -->|"login con correo, wallet embebida"| PV["Privy"]
    HM -->|"lee precios"| PY["Pyth (precios on-chain)"]
    HM -->|"guarda y mueve dólares"| SOL["Solana devnet (USDC)"]
    SOL -->|"eventos del programa"| QN["QuickNode Streams"]
    QN -->|"webhook"| HM
    HM -->|"voz (opcional)"| EL["ElevenLabs"]
```

## 3. C4, nivel 2: contenedores

```mermaid
flowchart TB
    subgraph Cel["Celular del usuario"]
      WEB["App web Next.js<br/>UI tipo juego · React"]
    end
    subgraph Srv["Vercel (mismo despliegue)"]
      API["Rutas /api de Next.js<br/>relayer (fee payer) · webhook de Streams · avisos"]
    end
    subgraph Chain["Solana devnet"]
      PROG["Programa Anchor house_money<br/>reglas de dinero (fuente de verdad)"]
      ACC[("Cuentas PDA<br/>Config · UserVault · Play · League<br/>vaults de USDC")]
      PYTH[("Cuentas de precio Pyth<br/>SOL/USD")]
    end
    PRIVY["Privy<br/>wallet embebida"]
    QN["QuickNode Streams<br/>filtro: program id + eventos"]

    WEB -->|"login"| PRIVY
    WEB -->|"pide transacción firmada por el usuario"| API
    API -->|"agrega firma de fee payer y envía"| PROG
    PROG --> ACC
    PROG -->|"lee precio"| PYTH
    WEB -->|"lee estado (RPC)"| ACC
    PROG -->|"logs de eventos"| QN
    QN -->|"POST /api/streams"| API
    API -->|"push / correo / voz"| WEB
```

## 4. C4, nivel 3: componentes del programa on-chain

| Cuenta (PDA) | Semillas | Qué guarda | Experto GRASP de… |
|---|---|---|---|
| `Config` | `["config"]` | admin, mint de USDC, tope de boost (5), tope de ganancia (2x), tolerancia de precio, modo demo | Parámetros del juego |
| `UserVault` | `["vault", user]` | `principal`, `house_money`, `last_accrual_ts`, `streak`, `open_play` | **Cuánto puede jugar el usuario** (tiene la información) |
| `Play` | `["play", user, week]` | dirección, boost, monto, precio de entrada, vence, estado | Su propio resultado |
| `League` | `["league", code]` | hasta 8 miembros, semana actual | El ranking |
| `vault_usdc` | token account del programa | El dinero de todos los Vaults | — |
| `house_pool` | token account del programa | Contraparte de las jugadas y reserva para el interés de la demo | — |

**Instrucciones:** `init_config`, `create_vault`, `deposit`, `withdraw_principal`, `accrue_interest`, `open_play`, `settle_play`, `create_league`, `join_league`.

### Invariantes (lo que se prueba con tests y se cuenta a los jueces)

1. `principal` solo baja con `withdraw_principal`, y solo hacia la wallet del dueño.
2. `open_play.stake ≤ house_money`. **No existe ninguna instrucción que pase dinero del principal al house money.**
3. **No se puede depositar directo en `house_money`**: solo lo llena `accrue_interest` (y el bono de bienvenida).
4. `boost ≤ Config.max_boost` (5) y una sola jugada abierta por usuario.
5. Ganancia máxima por jugada = `stake × Config.max_win_multiple` (2x), para que el pozo de la casa no se vacíe.
6. `settle_play` usa el precio de Pyth con antigüedad ≤ `Config.max_price_age`; si no hay precio válido, la jugada se devuelve sin ganar ni perder.

## 5. Patrones elegidos (los 4 elementos)

| Patrón | Problema | Solución | Consecuencias |
|---|---|---|---|
| **State** (GoF) | Una jugada se comporta distinto según su momento (abierta, ganada, knockout, devuelta); con banderas sueltas habría combinaciones inválidas | `PlayState` como enum con transiciones explícitas validadas en el programa (`Open → Won / Knockout / Refunded → Settled`) | + Imposible liquidar dos veces o liquidar una jugada cerrada. − Cada estado nuevo exige tocar el `match` (aceptable: son pocos) |
| **Strategy** (GoF) para la fuente de precio | En devnet Pyth se actualiza poco y la demo necesita "avanzar el tiempo" sin mentir | Interfaz `PriceSource` en el programa: `PythSource` (real) y `DemoSource` (solo si `Config.demo_mode` y firmado por el admin; la UI lo etiqueta "DEMO") | + Demo fiable y honesta; en mainnet `demo_mode` queda apagado por configuración. − Hay que asegurarse de que `DemoSource` no exista fuera de devnet |
| **Facade** (GoF) + **Indirección** (GRASP) | La UI no debe conocer Anchor, PDAs ni firmas; si cambia el programa, se romperían todas las pantallas | `lib/house-money/client.ts` expone `deposit()`, `callIt()`, `settle()`, `getHome()`; las pantallas solo hablan con esa fachada | + Bajo acoplamiento: se puede desarrollar el frontend con datos simulados hoy y conectar el programa mañana. − Una capa más que mantener |
| **Adapter** (GoF) | Privy (wallet embebida) y el relayer tienen interfaces distintas a la de Anchor | `PrivySignerAdapter` adapta la wallet de Privy a `Signer`; `RelayerAdapter` agrega la firma del fee payer | + Cambiar de Privy a otra wallet toca un solo archivo |
| **Controlador** (GRASP) | ¿Quién recibe la petición de "paga mi gas" y decide si la acepta? | Ruta `/api/relay` como controlador: valida que la transacción solo llame a `house_money` y la reenvía | + Evita que alguien use nuestro fee payer para otra cosa (seguridad) |
| **Observer** + **Idempotent Consumer** | Los avisos ("Ana ya jugó", "knockout") dependen de lo que pase on-chain | QuickNode Streams observa el programa → `POST /api/streams` → avisos. La firma de la transacción es la clave de idempotencia | + Desacoplado del flujo principal; si falla un aviso, el dinero no se entera. − Consistencia eventual (aceptable para avisos) |

**Anti-patrones que evitamos** (según `anti_patrones.md`):
- **God Object:** no hay una instrucción "hacer todo"; una por acción.
- **Dual Write:** el backend no guarda saldos propios. El dinero vive solo on-chain y la UI lee de ahí.
- **Golden Hammer:** no metemos microservicios ni base de datos si no hacen falta.

## 6. Máquina de estados de una jugada

```mermaid
stateDiagram-v2
    [*] --> Abierta: open_play (stake ≤ house money, boost ≤ 5)
    Abierta --> Ganada: settle_play · precio a favor
    Abierta --> Knockout: settle_play · pérdida ≥ stake
    Abierta --> Perdida: settle_play · precio en contra, pérdida < stake
    Abierta --> Devuelta: settle_play · sin precio válido
    Ganada --> Liquidada: paga stake + ganancia (tope 2x) desde el pozo
    Perdida --> Liquidada: devuelve lo que queda; el resto va al pozo
    Knockout --> Liquidada: el stake entero va al pozo
    Devuelta --> Liquidada: devuelve el stake
    Liquidada --> [*]
```

## 7. Flujos (secuencia)

### 7.1 Registro y primer depósito

```mermaid
sequenceDiagram
    actor Ana
    participant App as App (Next.js)
    participant Privy
    participant Relay as /api/relay (fee payer)
    participant Prog as Programa house_money
    Ana->>App: "Continue with email"
    App->>Privy: login + crear wallet embebida
    Privy-->>App: wallet lista (Ana no la ve)
    Ana->>App: Deposita 1.000 $ en su Vault
    App->>App: arma create_vault + deposit
    App->>Privy: Ana firma (un toque)
    App->>Relay: transacción firmada por Ana
    Relay->>Relay: valida que solo llama a house_money
    Relay->>Prog: agrega firma de fee payer y envía
    Prog-->>App: Vault creado · principal = 1.000 $ · bono de bienvenida = 10 $
    App-->>Ana: "Your Vault: $1,000 🔒 · House money: $10"
```

### 7.2 Interés semanal (house money)

```mermaid
sequenceDiagram
    participant Cron as Cron semanal (o botón DEMO)
    participant Prog as Programa house_money
    participant Pool as house_pool (reserva de interés)
    participant QN as QuickNode Streams
    Cron->>Prog: accrue_interest(user)
    Prog->>Prog: interés = principal × tasa × tiempo (tasa simulada en devnet)
    Prog->>Pool: mueve el interés a house_money del usuario
    Prog-->>QN: evento InterestAccrued
    QN-->>Cron: (aviso) "Your savings paid you $1.20 this week"
```

### 7.3 Call it: abrir la jugada

```mermaid
sequenceDiagram
    actor Ana
    participant App
    participant Relay as /api/relay
    participant Prog as Programa house_money
    participant Pyth as Pyth SOL/USD
    Ana->>App: "SOL this week?" → Up · Boost 3x · usa 10 $
    App-->>Ana: "Max you can lose: $10 · Your Vault never moves"
    Ana->>App: Lock in my call
    App->>Relay: open_play(Up, 3, 10 $) firmada por Ana
    Relay->>Prog: envía con fee payer
    Prog->>Prog: verifica stake ≤ house money, boost ≤ 5, sin jugada abierta
    Prog->>Pyth: lee precio de entrada (antigüedad ≤ tolerancia)
    Prog->>Prog: crea Play(Abierta, entrada = 73,87 $, vence = viernes 4 PM)
    Prog-->>App: jugada abierta
```

### 7.4 Viernes: liquidar (gana o knockout)

```mermaid
sequenceDiagram
    participant Crank as Cualquiera (cron o el usuario)
    participant Prog as Programa house_money
    participant Pyth as Pyth SOL/USD
    participant Pool as house_pool
    participant QN as QuickNode Streams
    participant App
    Crank->>Prog: settle_play(Ana)
    Prog->>Pyth: precio de salida
    Prog->>Prog: resultado = stake × boost × variación %
    alt Gana
        Prog->>Pool: paga stake + ganancia (tope 2x stake) a house_money
    else Knockout (pérdida ≥ stake)
        Prog->>Pool: el stake va al pozo
    end
    Prog->>Prog: Play → Liquidada · actualiza racha
    Prog-->>QN: evento PlaySettled
    QN->>App: POST /api/streams (idempotente por firma)
    App-->>App: aviso + tarjeta para compartir
```

### 7.5 Liga semanal

```mermaid
sequenceDiagram
    actor Ana
    actor Leo
    participant App
    participant Prog as Programa house_money
    Ana->>App: Crea la liga "Dorm 4B"
    App->>Prog: create_league(code)
    Ana->>Leo: comparte el link
    Leo->>App: abre el link → login con correo
    App->>Prog: join_league(code)
    Note over App,Prog: Al cierre de cada semana la app lee los Play liquidados de los miembros
    App-->>Ana: Ranking por % sobre su house money (sin plata entre amigos)
```

## 8. Plan de construcción en 2,5 días (por capas, en paralelo)

| Bloque | Quién | Depende de |
|---|---|---|
| Frontend con datos simulados detrás de la fachada `client.ts` | 1 persona | Nada (empieza hoy) |
| Programa Anchor + tests de las 6 invariantes | 1-2 personas | Nada |
| Relayer `/api/relay` + Privy | 1 persona | La fachada |
| QuickNode Streams + `/api/streams` | 1 persona | El programa desplegado |
| Conectar la fachada al programa real | Todos | Todo lo anterior |

La fachada es la que permite trabajar en paralelo: el frontend no espera al programa.
