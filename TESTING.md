# DayPorter — manual testing checklist

On-device pass for the local-first CRM. Grounded in the actual screens and the
pure-module logic (`src/models.ts`, `src/dbCore.ts`). Items marked ⚠️ can't be
fully exercised until RevenueCat / App Store Connect are configured.

**Suggested first pass (highest value/risk):** branding → bid calculator math →
contract→MRR flow → backup round-trip → theme switch.

## Launch & branding
- [ ] Home screen shows the First Light icon (sun over floor line on navy), not the blank default
- [ ] Cold launch (force-quit, reopen) shows the navy splash with the sun motif, then the app
- [ ] Splash reads correctly in both light and dark device modes (stays navy in both)
- [ ] App name under the icon reads "DayPorter"

## Pipeline (home) screen
- [ ] Fresh install shows the "Add your first lead" empty state
- [ ] Adding a client via the inline field opens the client screen and lands it under Lead
- [ ] Each stage section shows the right color dot + card left-edge (grey / blue / amber / green / red)
- [ ] MRR headline is $0.00 with no active contracts
- [ ] "N active client(s)" count matches reality
- [ ] Follow-ups card appears only when something is due; overdue items show the "— N overdue" label
- [ ] Tapping a follow-up row jumps to that client

## Client detail screen
- [ ] Stage chips: tapping recolors and moves the client to that pipeline section
- [ ] Contact fields (name/phone/email/notes) persist after leaving and returning
- [ ] Add a site (label/address/sqft); a second site makes the site picker appear on contract/bid screens
- [ ] Add a contract (visits/wk, $ rate, /mo vs /visit, scope) → home MRR updates
- [ ] Pause a contract → MRR drops; Resume → MRR restores
- [ ] Per-visit contract: monthly value annualizes (rate × visits/wk × 52 ÷ 12)
- [ ] Log each activity kind (note/call/email/walkthrough/bid); set a follow-up chip (1d/3d/1w/2w)
- [ ] Mark a follow-up Done → it leaves the home follow-ups card
- [ ] Delete client → cascades sites, contracts, bids, log; MRR recalculates

## Bid calculator (flagship — check the math)
- [ ] Canonical: 10,000 sqft, 3×/wk, 3000 sqft/hr, $20/hr, 6% supplies, 30% margin → **$1,312.39/mo, $100.95/visit**
- [ ] Breakdown adds up: labor + supplies = cost; profit = price − cost; margin is a share of *price*
- [ ] Zero/blank sqft → $0.00, no crash
- [ ] Weird rate input ("$1,250.50", "abc", "12.999") handled sanely
- [ ] From a client: Save bid stores it in that client's Bids list with correct date/margin
- [ ] Standalone (from home): calculates, shows the "open a client to save" hint
- [ ] Changing Settings bid defaults changes the calculator's starting numbers

## Settings & theming
- [ ] Appearance System / Light / Dark flips the whole app live, no restart
- [ ] Status bar text stays legible in both themes on every screen
- [ ] Bid defaults persist across app restarts
- [ ] Export backup opens the share sheet with a `dayporter-backup-*.json` file
- [ ] Import backup → confirm dialog → replace-all restores everything exactly
- [ ] Round-trip: export, add junk client, import → junk gone, original intact

## Data integrity & persistence
- [ ] Survives force-quit and relaunch (SQLite)
- [ ] Survives a device reboot
- [ ] Works fully in airplane mode (local-first; nothing leaves the device)

## Monetization ⚠️ (limited until RevenueCat configured)
- [ ] With placeholder RC keys, Pro fails open → unlimited clients, no paywall. **The 10-client free gate will NOT trigger in this build — expected.** Testing the gate needs real RC keys (or a temporary `failOpen = false`).
- [ ] Once keys are in: adding an 11th client on free shows the "Client limit reached" alert
- [ ] "Restore purchases" doesn't crash
- [ ] Export is never gated regardless of Pro state

## Platform / robustness
- [ ] Rotate + large Dynamic Type — layouts don't clip (iPad layout is enabled)
- [ ] Rapid taps on steppers/chips don't double-fire or crash
- [ ] Long client names / notes truncate gracefully
- [ ] Android (when built): numeric keyboard types on rate/sqft fields; adaptive icon renders in the navy circle
