# REQNX Mobile Experience — Real-Device QA Protocol

This protocol provides step-by-step instructions for verifying the flagship mobile experience on physical hardware (iOS Safari and Android Chrome) over a local network.

---

## 1. Local Network Server Setup

1. Start the development server bound to all local interfaces:
   ```bash
   pnpm --filter @reqnx/site dev --host 0.0.0.0
   ```
2. Note your workstation's LAN IP (e.g. `http://192.168.1.50:4321/`).
3. Connect your test phones to the same Wi-Fi network.
4. On your mobile browser, navigate to:
   - Primary: `http://<LAN_IP>:4321/`
   - Diagnostics: `http://<LAN_IP>:4321/dev/mobile-qa`

---

## 2. Target Device Matrix

| Device Class | Viewport (CSS px) | Target OS & Browser | Verification Focus |
|:---|:---|:---|:---|
| **iPhone Standard** | 390×844 | iOS 17/18/26 Safari | Bottom dock thumb reach, Dynamic Island/notch insets, Safari chrome tinting, back swipe sheet dismiss |
| **Android Standard** | 360×800 / 393×873 | Android Chrome / Samsung Internet | Hardware/gesture back navigation, touch-action responsiveness, vibration haptics toggle |
| **Compact / Stress** | 320×568 (or 360×780) | Any mobile browser | No horizontal overflow, text scaling, 44px tap targets fit cleanly |
| **Foldable / Tablet** | 600×900 / 768×1024 | Safari / Chrome | Sensible multi-column inheritance, dock retention vs layout reflow |

---

## 3. Automated Diagnostics via `/dev/mobile-qa`

Open `/dev/mobile-qa` on your physical device. The tool displays real-time telemetry:
1. **Viewport & Safe Areas**:
   - `innerWidth` × `innerHeight`, DPR
   - `visualViewport` height and dynamic offset
   - Computed `svh`, `dvh`, `lvh` measurements
   - Evaluated `env(safe-area-inset-*)` values
2. **Device Hardware & Network**:
   - `navigator.deviceMemory`, `hardwareConcurrency`
   - `navigator.connection` (effectiveType, saveData)
   - Media queries: `prefers-reduced-motion`, `prefers-contrast`, `prefers-color-scheme`
3. **Interactive Sheet & Dock Controls**:
   - Tap "Open Menu Sheet", "Open Search Sheet", "Open Contents Sheet"
   - Tap "Toggle Keyboard Simulation"
   - Tap "Sample Frame Jank" (runs 5-second 60fps raf loop measuring frame drops)
4. **Copy Report**:
   - Tap "Copy Diagnostic Report" to place all device telemetry onto your clipboard to paste into review notes.

---

## 4. Manual Real-Device Checklist

Execute this checklist sequentially on both iPhone and Android devices:

- [ ] **First Paint & Stability**: Load on simulated 4G or cellular. The status pill, H1, subhead, and primary CTA are readable within seconds. Zero layout shift (CLS $\le 0.02$).
- [ ] **Thumb Reach**: The primary CTA and console trigger buttons ("Send request", "Send burst") sit comfortably in the bottom 40% of the screen.
- [ ] **Touch Feedback**: Pointer-down creates visible pressed state within 90ms. No 300ms tap delay. Double-tap does not cause accidental zoom.
- [ ] **Scroll Rhythm**: Vertical scroll is buttery smooth. Native momentum and pull-to-refresh work without conflict. Zero horizontal scrollbar on body.
- [ ] **Dock Behavior**:
  - Dock stays fixed at the bottom with safe-area padding respecting the home indicator.
  - Dock does not obscure page footer or terminal content (page bottom-padding matches dock + safe-area).
  - Dock hides gracefully when software keyboard opens.
- [ ] **Sheets & Gestures (WCAG 2.5.1 / 2.5.7)**:
  - Swipe down on sheet handle dismisses sheet.
  - Visible Close button ("✕") dismisses sheet with a single tap (no drag required).
  - System back button (Android) and edge back swipe (iOS Safari) close the open sheet without leaving the page.
- [ ] **Search Experience**:
  - Tapping search in dock opens full-screen search immediately.
  - Input auto-focuses; font-size is 16px (no iOS auto-zoom).
  - Dismissing keyboard leaves zero phantom gaps or floating fixed elements.
- [ ] **iOS Safari Chrome Tinting**:
  - Status bar and bottom bar tint seamlessly match page surface tokens.
  - Background remains solid; no jarring color flashing during scroll.
- [ ] **Docs & Playground**:
  - Code blocks scroll horizontally with edge fades; 44px copy button remains reachable.
  - Reference tables stack neatly into vertical cards under 600px.
  - Dock slot switches to "Contents" on docs pages; tapping opens the section TOC sheet.
  - Playground timeline spans full width; Send pills remain reachable.
- [ ] **Accessibility & Lite Mode**:
  - Test at 200% system font size (iOS Larger Text / Android font scale): layout reflows without text truncation.
  - Enabling "Reduce Motion" disables animations and activates instant sheet transitions.
