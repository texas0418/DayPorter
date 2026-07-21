#!/bin/sh
# Patch expo-modules-jsi / expo-modules-core Swift sources so they compile under
# Xcode 26.0.1 (Swift 6.2.0). Expo SDK 57 targets Xcode >= 26.4, whose compiler
# accepts `weak let` (SE-0481); on 26.0.1 we rewrite to `nonisolated(unsafe)
# weak var` — same shape Expo already uses for adjacent unsafe stored props.
# Also swaps `abs(milliseconds)` for `.magnitude` in JavaScriptCodable+Date.swift
# (C++ interop makes `abs` ambiguous on the older compiler).
#
# Idempotent. Patches live only in node_modules — run after EVERY npm install.
# Retire this script once Xcode is updated to >= 26.4.
set -e
cd "$(dirname "$0")/.."

for d in node_modules/expo-modules-jsi/apple node_modules/expo-modules-core/ios; do
  [ -d "$d" ] || continue
  grep -rl "weak let" "$d" --include='*.swift' 2>/dev/null | while read -r f; do
    perl -pi -e 's/\bweak let /weak var /g' "$f"
  done
  grep -rl "weak var" "$d" --include='*.swift' 2>/dev/null | while read -r f; do
    perl -pi -e 's/^(\s*)((?:private |internal |public |fileprivate )?weak var )/$1nonisolated(unsafe) $2/ unless /nonisolated/' "$f"
  done
done

f=node_modules/expo-modules-jsi/apple/Sources/ExpoModulesJSI/Coding/JavaScriptCodable+Date.swift
[ -f "$f" ] && perl -pi -e 's/\babs\(milliseconds\)/milliseconds.magnitude/g' "$f"

remaining=$(grep -rn "weak let" node_modules/expo-modules-jsi/apple node_modules/expo-modules-core/ios --include='*.swift' 2>/dev/null | wc -l | tr -d ' ')
shims=$(grep -rn "nonisolated(unsafe) .*weak var" node_modules/expo-modules-jsi/apple node_modules/expo-modules-core/ios --include='*.swift' 2>/dev/null | wc -l | tr -d ' ')
echo "patch-jsi-xcode26: weak let remaining=$remaining, shims=$shims"
