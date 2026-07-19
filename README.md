# DayPorter

CRM for one niche: commercial cleaning and janitorial companies. The pipeline
is the way this industry actually sells — Lead → Walkthrough → Bid sent →
Active → Lost — with clients, their buildings (sites), recurring contracts
rolled up into monthly recurring revenue, follow-up reminders, and a proper
janitorial bid calculator (sqft × production rate → hours → labor + supplies
+ margin). Local-first: everything lives in SQLite on the phone, nothing
leaves the device.

Named for the day porter — the janitorial industry's daytime on-site staff.

## Stack

House pattern (see DreamFeed): Expo SDK 57, TypeScript strict, no navigation
library, plain StyleSheet. Pure logic in `src/models.ts`, `src/dbCore.ts`,
`src/backupFormat.ts` — all Node-tested without Expo.

Theming: light and dark palettes in `src/theme.ts`, resolved by `useTheme()`
(Settings: system / light / dark, default system). Screens build StyleSheets
from the palette via `makeStyles(c)` — no hardcoded mode anywhere.

## Run

```sh
npm install
npm test          # pure-module tests via tsx (bid math, MRR, schema, backup)
npx expo start    # everything works in Expo Go (purchases fail open)
```

## Monetization

RevenueCat one-time unlock (`dayporter_pro_lifetime`): unlimited clients after
10 free. Sites, contracts, bids, follow-ups, and export are free forever
(fail-open house rule — placeholder keys ⇒ Pro unlocked).

## Pre-ship TODOs

- [ ] App icon + splash (assets/ is empty; app.json has no icon refs yet) —
      dark-mode-aware splash now that userInterfaceStyle is "automatic"
- [ ] Create EAS project (`eas init`, owner boyscout1970) and paste projectId into app.json
- [ ] Create RevenueCat project; paste real keys into src/revenuecat.ts and
      CONFIRM the entitlement id on the RC dashboard (`pro` vs `Pro` trap)
- [ ] Create `dayporter_pro_lifetime` non-consumable in App Store Connect / Play
- [ ] Decide price point for Pro (this one's a business tool — can price higher
      than the consumer apps)
- [ ] Test contract/bid flows on Android (all prompts use inline inputs, no
      Alert.prompt, but verify keyboard types)
- [ ] Consider v2: per-site cleaning checklists, invoice export (Invoicer
      crossover?), win/loss stats by bid margin
