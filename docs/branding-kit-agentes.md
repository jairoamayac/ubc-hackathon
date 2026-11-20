# Branding kit for AI agents

Version 0.2, 2026-11-20 (0.1 had the name pending; 0.2 sets the name to Kept). Owner: Martín Gütter. Decisions on product and publishing: Josué Valles.

This file tells every AI agent on the team how the project looks, sounds and behaves in public. Read it before writing any copy, slide, README, post, UI text or image prompt. If something here conflicts with a direct instruction from Martín or Josué, the instruction wins.

## 1. Status of the open decisions

* Project name: **Kept** (team decision, relayed by Martín on 2026-11-20). Earlier working names were "Burn the Boats" and "House Money"; do not use them in new public copy.
* Name candidates that were discussed before (history only): Rubicon, Commit, Iacta, Pacta, Pinky, Plink.
* Logo: provisional. Use the plain wordmark with the dot detail (see section 4) until the final logo exists.
* Before anything public: check domain, X handle and Devpost for collisions with "Kept".

## 2. Brand idea

Core idea: commitment with no way back. A promise that keeps itself. The reference is "burn the boats": once you cross, you follow through. The tone is calm and a little philosophical, never dramatic.

Taglines (pick one per piece, do not stack them):
* Promises that keep themselves.
* Say it once. It stays said.
* Your word, enforced by math.
* A promise is a debt to your future self.
* Memory for money.

Product audience: everyday people who do not know crypto. Judges: technical and business people who have seconds to understand. Explain what it does before how it works.

## 3. Voice and tone

Voice in five words: simple, calm, direct, warm, thoughtful.

Rules:
* Language of the product, demo, README and Devpost: English. Internal notes and chat with the team: Spanish (Argentine, voseo) unless asked otherwise.
* Short sentences. One idea per sentence. Verb first for buttons and calls to action.
* Sentence case everywhere. No ALL CAPS, no Title Case in headings.
* Plain words over crypto jargon. Say "locked until the condition is met", not "smart contract escrow state".
* No exclamation marks in product copy. No emoji in product copy. One emoji at most in social posts, and only if it adds meaning.
* Do not use dashes as punctuation in team facing replies to Martín (he prefers none). In public copy, prefer commas, colons or periods.
* Avoid: revolutionary, seamless, unlock, empower, leverage, web3 native, to the moon, game changer, "in today's fast paced world".
* Never promise returns, yield or profit. Never give financial advice.

Do and don't:

| Do | Don't |
| :--- | :--- |
| Money is locked until the promise is kept. | Leverage our trustless escrow primitive to unlock value! |
| Start a pact | Click here to get started |
| Your funds are safe until you decide. | 100% secure, guaranteed |

## 4. Visual identity

Style: minimal with small details. Lots of white space, thin lines, one strong color, one tiny repeated detail. It should feel pleasant to open and understandable at a glance.

Palette (final: "Forest", no orange):

| Role | Name | Hex | Use |
| :--- | :--- | :--- | :--- |
| Background | Paper | #FAFAF7 | Page and slide background |
| Text | Ink | #1A1A18 | Body text, headings |
| Primary | Forest | #1F5F4A | Buttons, links, key shapes, the dot |
| Detail | Mint | #DDEFE5 | Pills, tags, soft highlights, cards |
| Lines | Stone | #E6E4DD | Hairline borders and dividers |
| Optional | Light forest | #5FA98A | Hover and secondary states only |

Usage ratio: about 80% Paper, 12% Ink, 6% Forest, 2% Mint. Forest is the only strong color. Never add orange, neon or gradients.

Contrast: Ink on Paper and white on Forest pass accessibility contrast. Do not put Forest text on Mint below 14px.

Typography:
* Headings and body: Inter, or the system sans serif if Inter is not available. Two weights only, 400 and 500.
* Code and addresses: JetBrains Mono, or the system monospace.
* Optional quote style for philosophical lines: a serif such as Source Serif, used sparingly.

Shape and layout:
* Corner radius 8px for controls, 12px for cards, full pill for tags.
* Borders: 0.5px to 1px in Stone. No drop shadows, no blur, no gradients.
* Generous spacing: 16px, 24px, 32px rhythm.

Signature details (repeat these, they are the brand):
* The dot: a small Forest circle (8px) before the name, like a status light.
* The pill: a Mint pill with the word "Locked" in Forest, used for funds or promises that are committed.

Wordmark until the logo exists: a Forest dot, then the name in Ink, weight 500, sentence case, for example "● Kept".

Image generation prompt base (for image agents): "Minimal flat design on warm off white background (#FAFAF7), thin hairline lines, a single deep forest green (#1F5F4A) accent, soft mint (#DDEFE5) highlights, lots of empty space, no gradients, no shadows, no text unless requested, calm and trustworthy mood."

## 5. Channel guidelines

X posts:
* Under 240 characters. Lead with the human problem, then the product, then one call to action.
* One tagline at most. At most two hashtags. Tag sponsors only when relevant and approved.
* Never publish without approval from Josué or Martín.

Devpost:
* Structure: Problem, Solution, How it works, Why onchain, Impact, What's next.
* Start with one plain sentence a stranger understands. Map content to the judging criteria: Technical Execution, Product and UX, Innovation, Impact and Potential, Demo.

README (also needed for the Grok Bot bounty):
* 3 to 4 sentences in the first paragraph: what it is, who it is for, what it does, why onchain.
* Then: setup, architecture in one diagram or list, links to demo and video.

Pitch and slides:
* Background Paper, text Ink, one Forest highlight per slide. Max 6 words in a slide title, one idea per slide.
* Opening line options: "Every promise has a moment where someone walks away. We removed that moment." Adjust to the final product.

Demo video:
* Under 2 minutes. Show the problem in the first 10 seconds. Captions in Ink on Paper or white on Forest. No background music with lyrics.

UI copy:
* Buttons: verb first, 1 to 3 words ("Start a pact", "Lock funds", "Release").
* Errors: say what happened, then what to do. No raw error strings, no first person.
* Empty states: an invitation, not an apology.

## 6. Templates

Short post:
```
{{one sentence on the human problem}}
Kept {{what it does in plain words}}.
{{tagline}}
{{link}}
```

README opening:
```
Kept is {{what it is}} for {{who}}. It lets {{people}} {{do the thing}} without {{the pain}}. Funds are held onchain until {{condition}}, so nobody has to trust anybody. Built at UBC 2026.
```

Devpost first line:
```
Kept turns a promise into something that keeps itself.
```

## 7. Rules for agents

* Facts, hypotheses and opinions stay separated and marked.
* Do not invent features, numbers, partnerships, quotes or results. If unsure, write "to confirm".
* Product facts as implemented in the repo (jairoamayac/ubc-hackathon, commit 04d59c5): each person locks money on their own goal, only people who put money in confirm results, and when someone walks away the platform takes 5% and the friends who kept their word share 95%. An earlier idea of a 60/40 split is not what the program does; confirm with Josué before quoting any other number.
* The appeal with a screenshot, "Reviewed by Grok", is a simulated demo for now. Never present it as a live review.
* Nothing irreversible without Josué's approval: no public posts, no spending, no permissions, no code or repo changes outside your task.
* Do not store sensitive data (passport, full wallet or seed phrases) in any file.
* Every change an agent makes must be logged in `00-bitacora-de-cambios` in the UBC Project: date (UTC), who, what, where.
* Respect trademarks and licenses. Do not copy other projects' logos, names or taglines.

## 8. Pre delivery checklist

* The product is called Kept. No older names in new copy.
* Only palette colors used. No gradients, shadows or neon.
* Sentence case, short sentences, no banned words, no promises of returns.
* Claims are true and checkable. Links work.
* Approval obtained if the piece goes public.

## 9. Open items

* Domain, X handle and Devpost collision check for Kept.
* Logo: three directions (wordmark only, symbol plus wordmark, monogram) to be drawn now that the name is Kept.
* Confirm Inter and JetBrains Mono availability for slides and video.
