# Zap MVP Design System

## Product Overview

**Product Type:** Tool (Networking/Social Exploration)  
**Target Audience:** Early-career professionals, career changers, students exploring options  
**Core Tone:** Casual, low-pressure, exploratory, approachable, modern  
**Platform:** React Native + Expo (iOS/Android)

---

## 1. Style & Visual Language

### Chosen Style: **Modern Minimalism with Friendly Warmth**

- **Primary aesthetic:** Clean, minimal with subtle gradients and soft shadows
- **Color approach:** Bright, approachable primaries paired with neutral backgrounds
- **Effects:** Soft shadows (elevation 1-4), no harsh edges, 16px border radius on cards
- **Icon style:** Outline icons, consistent 2pt stroke, rounded corners
- **Anti-pattern:** Do NOT use harsh gradients, corporate formality (LinkedIn-like), heavy borders

---

## 2. Color System

### Light Mode

| Token | Purpose | Hex | RGB |
|-------|---------|-----|-----|
| `primary` | Primary action, swipe right, CTAs | `#6366F1` | Indigo-500 |
| `primary-dark` | Hover/pressed state | `#4F46E5` | Indigo-600 |
| `secondary` | Secondary actions, accents | `#EC4899` | Pink-500 |
| `success` | Match confirmation, liked state | `#10B981` | Emerald-500 |
| `error` | Validation errors, destructive | `#EF4444` | Red-500 |
| `warning` | Warnings, caution states | `#F59E0B` | Amber-500 |
| `surface-bg` | Main background | `#FFFFFF` | White |
| `surface-card` | Card/elevated surfaces | `#F9FAFB` | Gray-50 |
| `surface-input` | Input fields, text areas | `#F3F4F6` | Gray-100 |
| `text-primary` | Body text, headings | `#111827` | Gray-900 |
| `text-secondary` | Helper text, labels | `#6B7280` | Gray-500 |
| `text-tertiary` | Placeholder, disabled | `#9CA3AF` | Gray-400 |
| `border` | Dividers, subtle borders | `#E5E7EB` | Gray-200 |

### Dark Mode

| Token | Purpose | Hex |
|-------|---------|-----|
| `primary` | Primary action | `#818CF8` | Indigo-400 |
| `surface-bg` | Main background | `#0F172A` | Slate-900 |
| `surface-card` | Cards | `#1E293B` | Slate-800 |
| `surface-input` | Inputs | `#334155` | Slate-700 |
| `text-primary` | Body/headings | `#F1F5F9` | Slate-100 |
| `text-secondary` | Helper text | `#CBD5E1` | Slate-300 |
| `text-tertiary` | Placeholder | `#94A3B8` | Slate-400 |
| `border` | Dividers | `#475569` | Slate-600 |

**Contrast verification (WCAG AA):**
- Primary text on light bg: 4.5:1+ ✓
- Primary text on dark bg: 4.5:1+ ✓
- Interactive elements: 3:1 minimum ✓

---

## 3. Typography System

### Type Scale

| Role | Size | Weight | Line Height | Use Case |
|------|------|--------|-------------|----------|
| `display` | 32pt | 700 | 1.2 | Splash screens, major headings |
| `headline` | 24pt | 700 | 1.3 | Screen titles, modals |
| `title` | 20pt | 600 | 1.4 | Section headings, card titles |
| `body` | 16pt | 400 | 1.5 | Body copy, descriptions |
| `label` | 14pt | 600 | 1.4 | Button labels, form labels |
| `caption` | 12pt | 400 | 1.5 | Helper text, timestamps |

### Font Pairing

- **Headings:** System font (SF Pro Display on iOS, Roboto on Android)
- **Body:** System font with fallback to -apple-system or Roboto
- **Rationale:** Native platform consistency + accessibility benefits

---

## 4. Spacing & Layout System

### Base Unit: 4pt Grid

| Token | Value | Use Case |
|-------|-------|----------|
| `space-xs` | 4pt | Micro gaps (icon-text spacing) |
| `space-sm` | 8pt | Tight spacing (chip gaps, small padding) |
| `space-md` | 12pt | Standard padding around text |
| `space-lg` | 16pt | Section padding, card internal padding |
| `space-xl` | 24pt | Section gaps, major breaks |
| `space-2xl` | 32pt | Screen-level gaps |

### Safe Area Compliance

- Always respect top safe area for headers (status bar + notch)
- Always respect bottom safe area for tab bars, CTAs
- Minimum 16pt horizontal inset on all screens

### Screen Container Width

- Mobile: Full width minus 16pt horizontal padding
- Max content width: No constraint (phones are <450pt)

---

## 5. Components & Interaction

### Button States & Timing

| State | Background | Text Color | Opacity | Duration |
|-------|------------|-----------|---------|----------|
| Default | `primary` | White | 1.0 | — |
| Pressed | `primary-dark` | White | 1.0 | 80ms |
| Disabled | `surface-input` | `text-tertiary` | 0.5 | — |
| Loading | `primary` | White | 0.7 | Pulse 1.5s |

**Touch target:** Minimum 44×44pt (iOS) / 48×48dp (Android)  
**Animation:** Spring easing, 150-200ms for press feedback

### Card Component

- Elevation: 1–2pt shadow (light) / soft glow (dark)
- Border radius: 16pt
- Padding: 16pt (internal)
- Gap between cards: 12pt
- Background: `surface-card`
- Pressed state: Scale 0.98 + opacity 0.9, no layout shift

### Input Fields

- Height: 48pt (touch-friendly)
- Border radius: 12pt
- Padding: 12pt horizontal, 14pt vertical
- Font: 16pt (prevents auto-zoom on iOS)
- Border: 1pt `border` color
- Focus state: Border `primary` + shadow
- Error state: Border `error` + 2pt underline
- Label: Above input, 14pt, 600 weight, margin-bottom 8pt

### Swipe Deck Card

- Width: 100% minus 32pt (16pt padding each side)
- Height: 70vh (viewport-relative)
- Border radius: 20pt (larger for prominence)
- Image: aspectRatio 2/3 (portrait-like)
- Info section: 16pt padding below image
- Gesture feedback: Real-time scale/rotate during swipe
- Snap-to-side: Spring easing, 300ms snap duration

---

## 6. Animation & Motion

### Timing Tokens

| Type | Duration | Easing | Use Case |
|------|----------|--------|----------|
| Micro-interaction | 150ms | ease-out | Button press, feedback |
| Transition | 200ms | ease-in-out | State changes (visible→hidden) |
| Modal entry | 250ms | ease-out | Sheet, modal slide-up |
| Swipe snap | 300ms | cubic-bezier(0.34, 1.56, 0.64, 1) | Deck card snap (spring) |
| List stagger | 30ms per item | ease-out | List item reveal |

### Specific Animations

| Element | Motion | Timing |
|---------|--------|--------|
| Button press | Scale 0.95 + opacity 0.9 | 80ms |
| Card like/pass | Scale + fade out + rotate (±20°) | 200ms ease-out |
| Match toast | Slide up + fade in | 250ms ease-out |
| Notification badge | Scale pulse (1.0 → 1.1 → 1.0) | 600ms infinite |
| Navigation slide | Translate X ±100% | 200ms ease-in-out |

**Reduced motion:** If `prefers-reduced-motion`, all animations reduce to 50ms instant or skip transforms entirely.

---

## 7. Accessibility

### Contrast Requirements (WCAG AA)

- Normal text: 4.5:1 minimum
- Large text (18pt+): 3:1 minimum
- UI components: 3:1 minimum
- **Test both light and dark modes independently**

### Touch & Keyboard

- All tap targets ≥44×44pt minimum
- Gap between targets: 8pt minimum
- Tab order matches visual top-to-bottom order
- All interactive elements support keyboard navigation

### Labeling & Feedback

- All icon-only buttons use `accessibilityLabel`
- Form fields have visible labels (not placeholder-only)
- Error messages appear below field with `role="alert"`
- Loading states announce progress: "Loading... 60% complete"
- Success feedback: Screen reader announces "Matched!" on connection

### Dark Mode & Dynamic Type

- Support system dark mode toggle
- Support Dynamic Type scaling up to 200% without layout breakage
- Use `flexGrow` and `flex` for responsive text areas
- Test text truncation at each size

---

## 8. Layout & Responsive

### Breakpoints (Device Classes)

| Class | Width Range | Orientation | Safe Inset |
|-------|-------------|-------------|-----------|
| Small phone | 320–374pt | Portrait | 16pt |
| Standard phone | 375–428pt | Portrait | 16pt |
| Large phone | 429–600pt | Portrait | 16pt |
| Landscape | Any | Landscape | 16pt |

### Viewport Configuration

```
width=device-width, initial-scale=1.0, user-scalable=yes
```

**Never** disable zoom or set `viewport-fit=cover` without respecting safe areas.

### Layout Rules

- Content never extends into safe areas (status bar, notch, gesture bar)
- Scroll content has bottom padding for sticky/fixed elements
- No horizontal scroll on any screen
- Sections separated by `space-xl` (24pt) vertically

---

## 9. Light/Dark Mode

### Color Mapping Strategy

All semantic tokens are **theme-aware**. Implementation uses:

```javascript
const colors = {
  light: { primary: '#6366F1', bg: '#FFFFFF', ... },
  dark: { primary: '#818CF8', bg: '#0F172A', ... }
}
```

### Mode-Specific Rules

| Element | Light | Dark | Note |
|---------|-------|------|------|
| Card elevation | 1–2pt shadow | Soft glow (opacity 0.1 white) | Subtle separation |
| Modal scrim | 40% black | 60% black | Dark mode needs stronger scrim |
| Text on surface | `text-primary` (900) | `text-primary` (100) | Both 4.5:1+ contrast |
| Input background | `surface-input` (100) | `surface-input` (700) | Clear separation from surface |

**Testing:** Always verify both themes independently before launch.

---

## 10. Anti-Patterns (Avoid)

- ❌ Using emojis for navigation or system icons → use SVG
- ❌ Mixing filled + outline icons at same hierarchy → choose one style
- ❌ Hardcoded colors per screen → use semantic tokens
- ❌ Animations that shift layout (width/height changes) → use transform only
- ❌ Placeholder-only form labels → always use visible label + helper
- ❌ No visual feedback on tap → always show pressed state within 80–150ms
- ❌ Touch targets <44pt → always ≥44×44pt minimum
- ❌ Ignoring safe areas → status bar, notch, gesture bar must be respected
- ❌ Defining interaction states for light mode only → both themes equally polished

---

## 11. Pre-Delivery Checklist

Before each screen launches:

- [ ] All tappable elements ≥44×44pt with 8pt gap minimum
- [ ] Tap feedback visible within 150ms (scale/opacity, no layout shift)
- [ ] Text contrast ≥4.5:1 in both light and dark modes
- [ ] No hardcoded hex values (all from semantic token system)
- [ ] Dark mode scrim opacity 60% for modals
- [ ] Form labels visible above inputs (not placeholder)
- [ ] Loading states show progress announcement for accessibility
- [ ] Reduced motion respected (animations skip or reduce to 50ms)
- [ ] Dynamic Type tested at 200% scaling without truncation
- [ ] Safe area respected on all fixed/sticky elements

---

## 12. Implementation Notes

### React Native Specifics

- Use `Pressable` with `onPressIn`/`onPressOut` for consistent tap feedback
- Use `Animated` API for swipe deck spring animations
- Use `useColorScheme()` hook to detect dark mode
- Use `useSafeAreaInsets()` for notch/gesture bar padding
- Use `FlatList` with `removeClippedSubviews` for long lists
- Preload next swipe card image before user swipes to last visible card

### Styling Approach

- Use a centralized `theme.ts` file exporting all tokens
- Define reusable component style presets (button.sm, button.lg, etc.)
- Use CSS-in-JS via StyleSheet for performance
- Never use fixed widths; use percentage or flex-based layouts

---

## 13. Zap-Specific Details

### Discovery Swipe Deck

- **Card height:** 70vh (visual prominence)
- **Image aspect:** 2:3 (portrait, realistic profile photo)
- **Swipe threshold:** 30% card width to trigger action
- **Visual feedback:** Card follows finger in real-time; snap-back if <30% threshold
- **Like action:** Card animates out with scale-up + rotate + fade
- **Pass action:** Card animates out with rotate-left + fade
- **Match notification:** Toast slide-up with `success` color + checkmark icon

### Notification Banner

- **Position:** Top of screen, below safe area
- **Height:** 64pt (touch-safe)
- **Auto-dismiss:** 5 seconds after appear, or on tap
- **Animation:** Slide down + fade in (200ms), slide up + fade out (200ms on dismiss)
- **Typography:** 14pt label weight, centered text
- **Icon:** Left-aligned checkmark or exclamation, 24pt

### Connection Card

- **Image:** 80×80pt rounded avatar
- **Title:** 16pt bold, name + role
- **Subtitle:** 14pt secondary, industry
- **Timestamp:** 12pt tertiary, "Matched 2 days ago"
- **Tap action:** Navigate to profile detail

---

End of design system.
