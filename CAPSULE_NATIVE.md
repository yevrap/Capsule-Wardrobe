# Capsule — Native App Specification

A local-first wardrobe inventory app for iPhone, iPad, and Mac.
Built natively in Swift so it earns a permanent place on the home screen.

---

## Why native now

The web prototype validated the product: photo inventory, outfit building, on-device visual matching,
and multi-profile management all work. What it couldn't do reliably on iOS:

- Safari evicts PWA data after ~7 days of non-use regardless of `storage.persist()`
- ONNX Runtime Web fails to create a session in iOS Safari's sandboxed WASM environment
- Camera, share sheets, and background processing are second-class citizens in WebKit

A native app solves all three with APIs Apple actively maintains and optimises.

---

## Stack decisions

| Layer | Choice | Why |
|---|---|---|
| Language | Swift 6 | Strict concurrency from day one — no migration debt |
| UI | SwiftUI | One codebase runs iPhone, iPad, and Mac natively |
| Persistence | SwiftData | `@Model` + `@Query` replaces Dexie; syncs with iCloud for free |
| Image handling | UIKit `UIImage` / `ImageRenderer` | JPEG compression at specific dimensions, just like the web version |
| Visual ML | Vision `VNFeaturePrintObservationRequest` | Built into iOS — no model download, no ONNX, no 3.5 MB file |
| Weather | WeatherKit | First-party, private, no API key required (Phase 4+) |
| Sync | CloudKit (via SwiftData) | One `modelContainer` flag enables iCloud sync |
| Widgets | WidgetKit | "Outfit of the day" lock-screen or home-screen widget (Phase 5+) |
| Siri | App Intents | "Hey Siri, log an outfit" or "What should I wear today?" (Phase 5+) |

**Minimum deployment: iOS 17 / macOS 14.** SwiftData and `@Observable` both require iOS 17.
Every iPhone currently on iOS 18 supports it. Do not drop the floor to support older devices —
the core APIs are not available there and the workarounds are not worth the complexity.

---

## Architecture

**No view models.** SwiftUI + SwiftData + `@Observable` do not need a separate ViewModel layer.
`@Query` fetches and reactively updates data directly in views. Business logic lives in service
structs (pure functions, no state) or model methods.

```
Capsule/
  App/
    CapsuleApp.swift          — @main, modelContainer setup
    AppState.swift            — @Observable global state (active profile, etc.)

  Models/                     — @Model types (SwiftData)
    Garment.swift
    Outfit.swift
    WearLog.swift
    Profile.swift

  Features/                   — one folder per product area
    Wardrobe/
    Identify/
    Outfits/
    Journal/
    Settings/

  Services/
    ImageService.swift        — compress, thumbnail, resize
    MatchingService.swift     — Vision feature print + cosine distance
    ExportService.swift       — ZIP backup + AI markdown export

  Extensions/                 — SwiftUI View extensions, Color helpers
```

**Concurrency:** use `async/await` everywhere. Image processing and Vision inference run on
`Task { }` blocks so they never block the main actor. Mark any type that crosses actor
boundaries with `Sendable`.

---

## Data model

Design mirrors the web prototype — same relationships, same intent.
SwiftData handles migrations automatically when you add properties to `@Model` types.

```swift
@Model
final class Profile {
    var id: UUID
    var name: String
    var createdAt: Date
    @Relationship(deleteRule: .cascade) var garments: [Garment]
    @Relationship(deleteRule: .cascade) var outfits: [Outfit]
}

@Model
final class Garment {
    var id: UUID
    var name: String
    var category: String           // "top", "bottom", "outerwear", etc.
    var subcategory: String?
    var colors: [String]
    var brand: String?
    var size: String?
    var material: [String]
    var seasons: [String]
    var tags: [String]
    var formality: Int             // 1–5
    var warmth: Int                // 1–5
    var price: Double?
    var purchaseDate: Date?
    var notes: String?
    var status: String             // "active", "stored", "donated"
    var wearCount: Int
    var lastWorn: Date?
    var embedding: [Float]?        // Vision feature print vector
    var createdAt: Date
    var updatedAt: Date
    @Relationship(deleteRule: .cascade) var photos: [GarmentPhoto]
    var owner: Profile?
}

@Model
final class GarmentPhoto {
    var id: UUID
    var tag: String                // "front", "back", "detail", "tag"
    var compressed: Data           // ~1200px / JPEG 85%
    var thumbnail: Data            // ~400px / JPEG 75%
    var capturedAt: Date
}

@Model
final class Outfit {
    var id: UUID
    var name: String
    var occasionTags: [String]
    var selfScore: Int?            // 1–5
    var timesWorn: Int
    var lastWorn: Date?
    var notes: String?
    var createdAt: Date
    var garments: [Garment]
    var owner: Profile?
}

@Model
final class WearLog {
    var id: UUID
    var date: Date
    var outfit: Outfit?
    var garments: [Garment]
    var notes: String?
    var createdAt: Date
    var owner: Profile?
}
```

---

## Visual matching: Vision, not ONNX

Replace the entire Web Worker + ONNX pipeline with two Vision calls:

```swift
// Generate a feature print for a photo (store on Garment.embedding as [Float])
func featurePrint(for image: UIImage) async throws -> VNFeaturePrintObservation {
    let request = VNGenerateImageFeaturePrintRequest()
    let handler = VNImageRequestHandler(cgImage: image.cgImage!, options: [:])
    try await withCheckedThrowingContinuation { continuation in
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                try handler.perform([request])
                continuation.resume(returning: request.results!.first!)
            } catch {
                continuation.resume(throwing: error)
            }
        }
    }
}

// Compare two feature prints
func distance(_ a: VNFeaturePrintObservation, _ b: VNFeaturePrintObservation) throws -> Float {
    var distance: Float = 0
    try a.computeDistance(&distance, to: b)
    return distance   // lower = more similar; threshold ~0.4 works well
}
```

`VNFeaturePrintObservationRequest` uses Apple's own image embedding model — the same one
that powers the Photos app's visual search. It runs on the Neural Engine, is fully offline,
and requires zero setup. Distance is inverted from cosine similarity (lower = closer match);
a threshold of 0.4–0.5 is a good starting point and should be user-adjustable in Settings.

Store the feature vector as `[Float]` on `Garment`. Serialise to `Data` if needed for
persistence (SwiftData handles `[Float]` natively).

---

## Phases

### Phase 0 — Foundation ✦ Start here

**Goal:** An app that opens, creates a profile, and shows an empty wardrobe. Nothing else.

- Xcode project: SwiftUI App template, SwiftData enabled, minimum iOS 17
- `CapsuleApp.swift`: set up `modelContainer` with `Profile`, `Garment`, `Outfit`, `WearLog`
- `AppState.swift` (`@Observable`): holds `activeProfile: Profile?`
- Onboarding screen: one tap creates a default profile, then the main tab view appears
- Tab bar: Wardrobe · Outfits · Journal · Settings (four tabs, empty views)
- Basic `NavigationStack` inside each tab
- Dark appearance: `preferredColorScheme(.dark)` on the root view; match the editorial palette from the prototype (`#0A0A0A` bg, `#C8B89A` accent)
- `navigator.storage.persist()` equivalent: SwiftData in the app sandbox is never evicted

**Done when:** app installs on a real device, onboarding works, tabs navigate.

---

### Phase 1 — Wardrobe inventory

**Goal:** Add, view, edit, and delete garments with photos.

- `PhotosPicker` (PhotosUI) for multi-image selection — no permission request needed for the
  picker itself; falls back to camera via `UIImagePickerController` / `AVFoundation` if the
  user wants to shoot live
- `ImageService`: `compress(image:)` → 1200px JPEG 85%, `thumbnail(image:)` → 400px JPEG 75%
- `GarmentFormView`: name, category (picker), colors (chip input), brand, size, material, tags,
  formality/warmth sliders, seasons, price, notes
- `WardrobeGridView`: `LazyVGrid` of thumbnail cards, search bar (`searchable`), category filter
  chips — mirrors the web prototype's inventory page
- `ItemDetailView`: photo strip (horizontal scroll), full metadata, edit and delete actions
- Tags: `[String]` on the model; a simple `TagInputView` component (chip-style, same idea as the web)
- Swipe-to-delete in list mode; confirmation alert before delete

**Key APIs:** `PhotosUI.PhotosPicker`, `CoreGraphics` for image resize, `SwiftData @Query`

**Done when:** can photograph a shirt, fill in metadata, see it in the grid, edit it, delete it.

---

### Phase 2 — Outfits

**Goal:** Combine garments into named outfits; track wear count.

- `OutfitFormView`: name, pick garments (multi-select grid from wardrobe), occasion tags,
  optional self-score (1–5 stars), notes
- `OutfitsGridView`: same card grid pattern as wardrobe
- `OutfitDetailView`: garment tiles in a wrap layout, wear count, last worn date
- "Wear today" button on outfit detail: creates a `WearLog` entry for today and increments
  `timesWorn` on the outfit and each garment
- Cost-per-wear derived value: `price / max(wearCount, 1)` — display in item detail

**Done when:** can build an outfit from existing garments and log wearing it.

---

### Phase 3 — Visual matching (Identify)

**Goal:** Point the camera at a garment and find it in the wardrobe.

- `IdentifyView`: camera preview (`AVCaptureSession`) with a capture button, plus a
  "Choose photo" fallback (`PhotosPicker`)
- On capture: run `ImageService.compress()` then `MatchingService.featurePrint(for:)`
- Compare against all garments that have an `embedding` stored; find nearest by
  `VNFeaturePrintObservation.computeDistance`
- If distance < threshold: show the matched garment with a confidence indicator
- If no match: offer "Add to wardrobe" with the photo pre-loaded into `GarmentFormView`
- Background indexing: when a garment is saved without an embedding, enqueue a
  `Task` to generate and save its feature print (use `modelContext.save()` after)
- Settings: threshold slider (user-adjustable, stored in `UserDefaults`)

**Key APIs:** `Vision.VNGenerateImageFeaturePrintRequest`, `AVFoundation.AVCaptureSession`

**Done when:** photo of a known garment returns the correct match within 2 seconds.

---

### Phase 4 — Journal & wear analytics

**Goal:** A daily wear log and per-garment statistics.

- `JournalView`: calendar-style list of `WearLog` entries, each showing outfit name and garment
  thumbnails for that day
- "Log today's look" flow: select garments (and optional outfit), add a note, save `WearLog`
- Per-garment stats in `ItemDetailView`: wear count, last worn date, cost-per-wear, days-since-worn
- Wardrobe health summary in Settings: total items, total photos, most-worn, never-worn count

**Done when:** wear history is visible per garment and in a daily log.

---

### Phase 5 — Recommendations & outfit scoring

**Goal:** The app suggests what to wear and scores outfit combinations.

#### Outfit scoring

Score each outfit on three axes (all computable from existing model fields, no AI needed):

```
colorHarmony    — 0–1: how well the garment colors work together
                  (hue distance from HSL values; analogous/complementary rules)

formalityMatch  — 0–1: standard deviation of formality values across garments
                  (low std dev = well-matched formality)

seasonFit       — 0–1: fraction of garments whose seasons include today's season

totalScore      — weighted average, shown as 1–5 stars
```

Store `totalScore` on `Outfit` and recompute whenever garments change.
Display the score breakdown in `OutfitDetailView` so users understand it.

#### Weather-aware recommendations

- `WeatherKit` (no API key, built into iOS 16+): fetch today's high/low temperature
  and conditions
- `RecommendationService`: filter garments by season + warmth range matching today's
  temperature; rank by `timesWorn` ascending (surface under-worn items) and last-worn
  date descending (avoid repeats)
- "Wear today" suggestion card on the home tab: one recommended outfit with a
  one-line reason ("Warm enough for a light jacket · Not worn in 3 weeks")

#### App Intents (Siri + Shortcuts)

```swift
struct SuggestOutfitIntent: AppIntent {
    static var title: LocalizedStringResource = "Suggest an outfit"
    func perform() async throws -> some ReturnsValue<String> {
        let suggestion = await RecommendationService.suggest()
        return .result(value: suggestion.name)
    }
}
```

Add `AppShortcutsProvider` to surface this in Spotlight and Siri without any user setup.

**Done when:** the app surfaces a daily recommendation and outfit cards show a score.

---

### Phase 6 — Sync, export, and widgets

**Goal:** Data lives on all the user's devices; wardrobe is shareable with AI.

#### iCloud sync

Enable CloudKit on the SwiftData `modelContainer` in `CapsuleApp.swift`:

```swift
let schema = Schema([Profile.self, Garment.self, Outfit.self, WearLog.self])
let config = ModelConfiguration(schema: schema, cloudKitDatabase: .automatic)
```

That one flag pushes all data to iCloud and syncs across the user's devices.
No server, no account, no code changes to models or views.

#### AI export

Reproduce the web prototype's AI export: a ZIP containing `wardrobe.md` (markdown
summary of every garment and outfit) plus thumbnail JPEGs. `ShareLink` replaces the
manual share sheet dance from the web version:

```swift
ShareLink(item: exportURL, preview: SharePreview("My wardrobe"))
```

#### WidgetKit

A `WidgetBundle` with one widget: "Outfit of the day" — shows the top recommendation
and updates at 6 AM. Lock-screen and home-screen sizes. Reads from the shared
`modelContainer` (same CloudKit container, so it always reflects current data).

---

## Design guidelines

Match the aesthetic from the web prototype — it tested well.

| Token | Value |
|---|---|
| Background | `Color(hex: "0A0A0A")` |
| Surface | `Color(hex: "141414")` |
| Border | `Color(hex: "2A2A2A")` |
| Text primary | `Color(hex: "F0EDE8")` |
| Text muted | `Color(hex: "6B6B6B")` |
| Accent | `Color(hex: "C8B89A")` |
| Danger | `Color(hex: "E05353")` |
| Success | `Color(hex: "5EAD6F")` |

- Define these in an `Assets.xcassets` Color Set with light/dark variants (dark = these values;
  light can be your own call, or stay dark-only for now)
- `Font.system(size: 28, weight: .ultraLight)` for page titles — the editorial feel comes
  from the thin weight
- `cornerRadius`: 12 for cards, 8 for chips, full for pill buttons
- Bottom tab bar on iPhone, sidebar on iPad (`NavigationSplitView` handles this automatically
  when you use `NavigationSplitView` at the root on iPad)
- Safe area insets: SwiftUI handles these automatically — no `env(safe-area-inset-*)` needed
- `touch-action: manipulation` equivalent: SwiftUI buttons have no tap delay by default

---

## What to skip in the first version

These were in the web prototype spec and can wait:

- Multi-profile UI (data model supports it, but single-profile UX is simpler to ship)
- Comparison quiz / Elo ranking (Phase 4+ of the original spec)
- Virtual try-on (requires third-party API or diffusion model — revisit when the core is solid)
- Baby/child growth tracking (add when the core family use case is proven)

---

## Getting started in Xcode

1. New project → App → Interface: SwiftUI → Storage: SwiftData → Language: Swift
2. Set minimum deployment to iOS 17.0
3. Add capabilities: iCloud (CloudKit), PhotoLibrary usage description (for PhotosPicker)
4. Create `Models/` group and add the four `@Model` types above
5. Replace the generated `ContentView` with a `TabView` that shows four empty views
6. Add the `AppState` observable and inject it via `.environment(AppState())` on the root view
7. Build and run on a real device (Simulator camera is limited; Vision works better on device)

The first real milestone is Phase 0 running on your iPhone with a profile created and
four empty tabs. Everything else builds from there.
