# Kept brand kit — "Lila y mandarina" v1

Date: Nov 20, 2026. With Josué's approval (Nov 20, 2026), this kit **overrides the visual section of Martín's "Kit de branding para agentes"** (v0.1, and v0.2 of the same day, which keeps Forest as the only strong color and allows no orange, gradients or shadows). That kit itself says a direct instruction from Josué wins. Martín's kit files were not modified. Its voice and copy rules still apply unchanged.

## Palette roles

| Name | HEX | Role |
|---|---|---|
| Lilac | #B9A4FF | Brand and hero surface: login, goal hero cards, app icon |
| Deep violet | #2E2260 | Text and progress on lilac (6.5:1 on Lilac) |
| Violet | #8F78F0 | 3D shading, rings, decorative only (3.3:1 on Paper, not for body text) |
| Lilac tint | #EEE8FF | Selected states, chips, soft fills |
| Mandarina | #FF7A3D | Primary actions (CTA) and celebration only |
| Mandarina edge | #D9551C | 4px bottom edge of 3D buttons |
| Paper | #FAFAF7 | App background |
| Ink | #1A1A18 | Text, bottom nav, dark tiles |
| Forest | #1F5F4A | Semantic states only: Locked / Kept / verified |
| Sky | #D6E6FF | Pastel: Study |
| Peach | #FFE3D3 | Pastel: soft mandarina tint |
| Mint | #CDEFD9 | Pastel: Fitness |
| Butter | #FFF0BF | Pastel: Habits |
| Lilac pastel | #E6DDFF | Pastel: Screen time |

Contrast rules:
- Ink on Mandarina (6.7:1) is the only allowed text on Mandarina. White on Mandarina (2.6:1) fails.
- On Lilac, use Deep violet (6.5:1) or Ink (8.1:1). White on Lilac (2.1:1) fails.
- White on Forest passes (7.5:1).

## Typography
- **Inter**:
  - Display numbers: 700, tight tracking (−4 to −5%), tabular figures.
  - Headings: 500 (H1 30/33, card titles 22/26).
  - Body: 400 (16/22).
  - Buttons: 600.
- **JetBrains Mono**: labels, IDs and receipt amounts (400–500).
- Sentence case everywhere. The one exception is the outlined uppercase "PUT SOMETHING" title (Inter 800) on the onboarding screen.

## Radii
- 8 px: controls and inputs.
- 12 px: small cards and tiles.
- 24 px: big cards and sheets.
- Buttons and pills: full pill (999 px).

## 3D button (primary)
- Mandarina #FF7A3D fill, **4 px solid #D9551C bottom edge**, Ink #1A1A18 text, Inter 600.
- On press: translateY(2px) and a 2px edge.
- Secondary: white pill with an Ink label and a Mandarina arrow circle ("Get started →").

## Shadows
- Cards and tiles: `0 8px 22px rgba(26,26,24,.07)`.
- Lilac hero card: `0 14px 30px rgba(110,80,220,.30)`.
- Floating white pill: `0 14px 30px rgba(46,34,96,.25), 0 3px 8px rgba(46,34,96,.12)`.
- Bottom nav (Ink): `0 12px 28px rgba(26,26,24,.28)`.
- 3D Mandarina button: the 4px #D9551C edge plus `0 8px 16px rgba(217,85,28,.28)`.
- Phone or hero mockups: `0 20px 50px rgba(46,34,96,.22)`.
- Shadows are tinted (violet, ink or mandarina) and soft. Never use hard black.

## 3D objects (legacy `elements/`)
- Glossy and soft: radial gradient body, one soft top-left highlight, a soft drop shadow below.
- **Lilac/violet and Mandarina only.** The single exception is the Forest check, used for Kept or verified meaning.
- Set: padlock, coin, donut, spheres, capsule, cube, confetti, check, chat bubble.
- Use them as hero decoration and never as icons inside text.

## 3D icon set (primary): `icons/`
Approved by Josué on Nov 20, 2026. **`icons/` is the primary 3D set.** The older SVG objects in `elements/` (spheres, cube, capsule and so on) are kept only for reference and legacy decoration.

- **Style:** chunky, soft, rounded, glossy clay or plastic, rendered like Blender. Soft studio light from the top left, gentle highlights, a slight 3/4 angle, friendly saturated colors, and one clear readable detail per icon.
- **Colors:**
  - Lilac #B9A4FF, Violet #8F78F0 and Deep violet #2E2260
  - Mandarina #FF7A3D
  - 3D sky #8FB8FF
  - Peach #FFB38A
  - Mint #9FE3C1
  - Butter #FFE08A
  - Forest #1F5F4A, only for the shield
- **Canvas:** 1024×1024 transparent PNG, the object centered with about 16% even padding (fits 840×720). Each icon has the same soft violet contact shadow under it: a blurred ellipse in rgba(46,34,96,.27).
- **Set:**

  | File | Meaning |
  |---|---|
  | `padlock-key` | hero, a locked stake |
  | `coins-stack` | stake |
  | `cash` | payout |
  | `money-bag` | group pot |
  | `calendar` | deadline, shows "22" |
  | `clock` | time left |
  | `shield-check` | verified (Forest) |
  | `trophy` | kept |
  | `friends` | group |
  | `camera` | proof upload |
  | `chat-check` | vote |
  | `piggy-bank` | savings |

- **Usage:**
  - Use them as hero and empty-state illustrations, at 64 px or larger.
  - Never place them inline in text and never use them as tab icons; the line icons stay for UI.
  - On lilac surfaces, add a soft white radial glow behind lilac icons (as in login v2) so they separate from the background.
- **How they were made:** AI image generation from one shared prompt style on plain grey, background removed with rembg (isnet-general-use), then trimmed, scaled, centered and given the shadow by `src/compose_icons.py`. The raw renders and cutouts are in `icons-src/`.

## Copy rules (from Martín's kit v0.1)
- English, sentence case, verbs on buttons ("Lock it in", "Get started").
- No "!" and no emoji.
- Banned words: revolutionary, seamless, unlock, empower, leverage, web3 native, to the moon, game changer.
- Never promise returns or give financial advice. Crypto stays invisible: talk about money, balance and stakes, not tokens or chains.

## Files
- `palette.png` (1600×1000): 14 swatches with HEX, RGB, role and contrast.
- `typography.png` (1600×1000).
- `brand-board.png` (1920×1080): one-page overview.
- `logo/`
  - `kept-wordmark-dark.png`: Ink text, Forest dot, transparent.
  - `kept-wordmark-light.png`: white text, Mandarina dot, transparent.
  - `kept-wordmark-on-lilac.png`.
  - `kept-app-icon-1024.png` and `kept-app-icon-512.png` (the 3D padlock-key on a lilac gradient with a soft white glow).
- `icons/` (1024×1024, transparent, **primary 3D set**): `padlock-key`, `coins-stack`, `cash`, `money-bag`, `calendar`, `clock`, `shield-check`, `trophy`, `friends`, `camera`, `chat-check`, `piggy-bank`.
- `icons-sheet.png` (1800×1260): 3×4 contact sheet with labels.
- `screens/`: `01-login.png` (login v2 with the 3D icon hero), `02-home.png`, `kept-v5-overview-b.png`.
- `icons-src/` (raw renders) and `src/fonts/` stay local; they are not in the zip or on Drive. Inter and JetBrains Mono are free under SIL OFL 1.1.
- `elements/` (1024×1024, transparent, legacy): `padlock-3d`, `coin-3d`, `donut-mandarina`, `sphere-lilac`, `sphere-mandarina`, `capsule-3d`, `cube-lilac`, `confetti`, `check-kept`, `chat-bubble-check`.
- `components/` (@2x, transparent): `button-primary-3d`, `button-white-pill`, `pill-locked`, `pill-kept`, `card-goal-lilac`, `card-pastel-set`, `bottom-nav`.
- `src/`: generators (`build.py`, `objs.py`, `icons.py`, `compose_icons.py`, `sheet.py`).
