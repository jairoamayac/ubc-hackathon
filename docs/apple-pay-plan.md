# Plan: Apple Pay de verdad en Kept (Solana)

Estado: plan. Hoy la recarga con "Apple Pay" está simulada (`/api/topup` entrega hmUSD de prueba).
Investigado el 2026-11-20 con la documentación oficial de cada proveedor.

## Decisión

**Usar Crossmint Onramp.** Es el único proveedor que cumple las tres cosas a la vez:

1. Entrega **USDC en Solana** directo en la wallet del usuario. La wallet es la llave que la app ya crea en el teléfono.
2. Tiene un **entorno de pruebas de autoservicio con USDC de devnet** documentado: token `solana:4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`. Se puede empezar hoy, sin esperar una aprobación.
3. Acepta **Apple Pay** en Safari y opera en LATAM, con KYC liviano hasta $1.000 al año. También ofrece **retiro** (off-ramp) desde Solana.

**Respaldo para mainnet: MoonPay.** Acepta Colombia, México, Brasil y Argentina, tiene Apple Pay y `usdc_sol`. Contras: cobra 4,5% con un mínimo de $3,99, y no permite retiro en Colombia.

### Descartados

| Proveedor | Por qué no |
|---|---|
| Stripe Onramp | Solo EE.UU. y la UE. Hay que postularse incluso para el modo de prueba. Apple Pay solo se habilita hablando con ventas. |
| Coinbase Onramp | Solo EE.UU., exige un celular de EE.UU. y el modo de prueba no entrega nada on-chain. |
| Transak | Su entorno de pruebas no tiene Solana. Exige una IP fija de backend, y Cloudflare Workers no la tiene. |
| Solana Pay / Helio | No hay tarjeta ni Apple Pay hacia la wallet del usuario: la plata va al comercio. |

## Cambio de fondo: de hmUSD a USDC

Crossmint entrega **USDC de Circle**, no nuestro hmUSD. El contrato fija **un solo mint por programa**: la config es un singleton (`seeds = [b"config"]`), y la reserva de Kamino se fija una sola vez. Por eso:

- **Devnet:** desplegar una **segunda instancia del programa** con un ID nuevo (unos 5 SOL de devnet, recuperables) y hacer `init_config` con el mint de USDC devnet `4zMMC…`. El programa hmUSD actual queda intacto para la demo.
- **Kamino devnet:** agregar a nuestro mercado una **reserva de USDC devnet** con el mismo oráculo USDC/USD. Para eso se usa `kamino-local-market.sh`/`kamino-manager add-asset-to-market` contra devnet.
- **Mainnet:** el mint es USDC `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` y se usa la **reserva USDC del mercado principal de Kamino**, que es real y ya tiene prestatarios. Ya no hace falta nuestro mercado ni nuestro prestatario.
- **App:** no cambia nada estructural. `MINT` y `KAMINO_*` ya son variables del Worker.

## Arquitectura

```
App (Safari / iOS)                    Worker (Cloudflare)                     Crossmint                Solana
"Agregar $50" ──POST /api/onramp/order──> crea la orden con CROSSMINT_API_KEY ──> /orders
              <── orderId + clientSecret ─┘
<CrossmintEmbeddedCheckout> ── Apple Pay / tarjeta ─────────────────────────> cobra, KYC
                                                                               └─ USDC ──> wallet del usuario
"Saldo $50" <── la app consulta el saldo (o el webhook de Crossmint → /api/onramp/webhook)
```

- La **API key** de Crossmint queda como secreto del Worker (`CROSSMINT_API_KEY`), igual que `SPONSOR_KEY` y `QUICKNODE_URL`. Nunca va en el repo ni llega al navegador.
- El **destino** es siempre la wallet del usuario. La plata nunca pasa por nosotros, así no tenemos custodia y queda fuera de transmisión de dinero.
- Después de recargar, el flujo es el de hoy: el USDC entra al pozo del grupo, el pozo se presta en Kamino y el sponsor paga las comisiones.

## Plan de trabajo

| # | Paso | Quién | Esfuerzo |
|---|---|---|---|
| 1 | Crear cuenta en Crossmint Console (staging), sacar la API key de servidor con scopes `orders.create` y `orders.read`, y verificar el dominio para Apple Pay | Equipo (requiere login) | 15 min |
| 2 | Desplegar la instancia USDC del programa en devnet y hacer `init_config` con el mint `4zMMC…` | Claude | 30 min |
| 3 | Agregar la reserva USDC devnet al mercado Kamino de devnet, más un prestatario | Claude | 45 min |
| 4 | Worker: `POST /api/onramp/order` (valida monto $5–$500 y wallet), `GET /api/onramp/order/:id` y un webhook con verificación de firma | Claude | 1 h |
| 5 | App: reemplazar `ApplePaySheet` por `CrossmintEmbeddedCheckout` (`@crossmint/client-sdk-react-ui`), con estados de pagando, confirmando y listo, y un tiempo límite | Claude | 1–2 h |
| 6 | Mantener la recarga simulada detrás de un flag (`ONRAMP=simulated\|crossmint`) para la demo offline | Claude | 15 min |
| 7 | Prueba e2e: orden en staging con la tarjeta de prueba `4242…`, confirmar que el USDC devnet llega a la wallet y que el pacto completo funciona | Claude | 30 min |
| 8 | Pruebas de seguridad del Worker: montos fuera de rango, wallet ajena, webhook falso | Claude | 30 min |
| 9 | Retiro: botón "Cash out" con el off-ramp de Crossmint (el usuario firma un depósito en Solana) | Después | 1–2 h |
| 10 | Mainnet: firmar order form y KYB con Crossmint, desplegar el programa en mainnet con USDC y la reserva principal de Kamino | Después de la hackathon | días |

## Riesgos a confirmar en el paso 7

- No está confirmado que el staging de Crossmint deposite USDC devnet on-chain; la documentación da el token, pero no lo dice explícitamente. Si no lo hace, la demo muestra el checkout y la recarga sigue simulada.
- No está confirmado que Apple Pay funcione en staging. Con la tarjeta de prueba alcanza para la demo; Apple Pay se prueba en Safari una vez verificado el dominio.
- No está confirmado que Apple Pay aparezca con tarjetas emitidas en LATAM.
- Las comisiones de Crossmint no son públicas, así que hay que pedirlas.

## Qué decir en el pitch

"La recarga usa un on-ramp real (Crossmint). En devnet se paga con tarjeta de prueba y llega USDC de prueba. En mainnet es Apple Pay → USDC directo en tu wallet, sin custodia nuestra."

## Fuentes

- Crossmint: [onramp](https://docs.crossmint.com/onramp/overview) · [quickstart React](https://docs.crossmint.com/onramp/quickstarts/react.md) · [métodos de pago](https://docs.crossmint.com/onramp/guides/payment-methods.md) · [KYC](https://docs.crossmint.com/onramp/introduction/user-onboarding.md) · [offramp](https://docs.crossmint.com/offramp/concepts/how-it-works)
- MoonPay: [test mode](https://dev.moonpay.com/platform/overview/test-mode) · [Apple Pay](https://dev.moonpay.com/platform/guides/pay-with-apple-pay.md) · [comisiones](https://support.moonpay.com/customers/docs/moonpay-fees)
- Stripe: [embedded onramp](https://docs.stripe.com/crypto/onramp/embedded-overview)
- Coinbase: [headless onramp](https://docs.cdp.coinbase.com/onramp/headless-onramp/overview)
- Transak: [sandbox](https://docs.transak.com/guides/sandbox-credentials.md)
- Solana Pay: [spec](https://solana.com/docs/tools/solana-pay/specification/version1-1)
