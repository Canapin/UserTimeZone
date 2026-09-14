# Vencord Plugin: UserTimeZone

## Goal

Lets users assign a timezone to any Discord user via right-click → **Set Timezone**, then shows
that user's local time:

- **On messages** — the message's send time, converted to the assigned timezone, inline next to the
  message (normal + compact display modes). Time only, no timezone suffix.
- **On profiles** — the user's *current* local time, as a profile badge and a profile section.
  Optionally suffixed with a timezone abbreviation (e.g. `CEST`).

Timezones are stored **locally** in the plugin settings. Nothing is sent to Discord and no backend
is required.

## Architecture

### Storage

Per-user timezones live in the plugin settings under `userTimezones`, a plain
`Record<userId, IANA timezone>`:

```ts
settings.store.userTimezones = { "1549063490650509453": "Europe/Berlin" }
```

Helpers:

| Function | Purpose |
|---|---|
| `getUserTimezone(userId): string \| null` | Read a user's configured timezone |
| `setUserTimezone(userId, tz \| null)` | Write/clear a user's timezone (reassigns the record) |

There is **no** bio encoding. (An earlier design used invisible Unicode tag characters embedded in
the user's bio — it was never implemented and has been dropped in favour of local storage.)

### Files

```
src/userplugins/UserTimeZone/
├── index.tsx        # Plugin entry: definePlugin, patches, components, context menu
├── styles.css       # Styling for message & profile time indicators
├── README.md        # User-facing documentation
└── AGENTS.md        # This file — instructions for AI agents
```

### Key Functions

| Function | Purpose |
|---|---|
| `getTzAbbreviation(tz, date?)` | Short TZ name for a given instant (DST-aware), e.g. `CEST` |
| `formatTime(tz, use24h, showAbbrev)` | Current time in `tz` (profile display), optionally abbreviated |
| `formatTimestamp(date, tz, use24h)` | Arbitrary instant in `tz`, **time only** (message display) |
| `getCommonTimezones()` | Timezone options from `Intl.supportedValuesOf("timeZone")` with a curated fallback |
| `useCurrentTimeFast(tz, use24h, showAbbrev)` | Ticking hook (1 s) for profile "current time" |

`formatTime` / `getTzAbbreviation` are used by profiles; `formatTimestamp` is used by messages.

### Timezone Data

`getCommonTimezones()` uses `Intl.supportedValuesOf("timeZone")` when available, otherwise a
curated list of ~60 common IANA timezones. Options are labelled `(ABBR) Region/City` and the `UTC`
option is marked `default: true`.

### Settings

| Key | Type | Default | Description |
|---|---|---|---|
| `userTimezones` | CUSTOM | `{}` | Internal `Record<userId, timezone>` (managed via the context menu) |
| `showOnProfile` | BOOLEAN | `true` | Show local time on profiles |
| `showOnMessages` | BOOLEAN | `true` | Show message time on messages |
| `use24h` | BOOLEAN | `false` | 24-hour time format |
| `showTzAbbrev` | BOOLEAN | `true` | Append the timezone abbreviation **on profiles only** |

### Patches

```ts
patches: [
    // Normal message display: insert after the timestamp
    {
        find: "showCommunicationDisabledStyles",
        replacement: {
            match: /(?<=return\s*\(0,\i\.jsxs?\)\(.+!\i&&)(\(0,\i.jsxs?\)\(.+?\{.+?\}\))/,
            replace: "[$1, $self.MessageTimeWrapper(arguments[0])]"
        }
    },
    // Compact message display: insert after the username
    {
        find: '="SYSTEM_TAG"',
        replacement: [{
            match: /className:\i\(\)\(\i\.className(?:,\i\.\i)?,\i\)\}\)(?:\))?,(?=\i)/g,
            replace: "$&$self.CompactMessageTimeWrapper(arguments[0]),"
        }]
    },
    // Profile: insert a time section into the profile header
    {
        find: "#{intl::USER_PROFILE_PRONOUNS}",
        replacement: {
            match: /(?<=\[)(?=\i," ",\i)/,
            replace: "$self.ProfileTimeSection({userId:arguments[0]?.user?.id}),"
        }
    }
]
```

The two message patches mirror `userMessagesPronouns` / `messageLatency` exactly.

### Message Display

`MessageTimeComponent` converts the **message's own timestamp** (`message.timestamp`, a `Date`) into
the assigned timezone. This is what makes the added time relative to the regular chat timestamp.

```tsx
function MessageTimeComponent({ message }: { message: Message }) {
    const tz = getUserTimezone(message.author.id);
    if (!tz) return null;
    const time = formatTimestamp(message.timestamp, tz, settings.store.use24h);
    if (!time) return null;
    return (
        <span className={classes(TimestampClasses.timestampInline, TimestampClasses.timestamp, "vc-utz-message")}>
            {" "}• 🕐 {time}
        </span>
    );
}
```

Because message timestamps are immutable, **no interval/ticking is needed** — do not reintroduce
one per message. Bots/system users and the `showOnMessages` setting are filtered by
`shouldShowMessage`.

### Profile Display

Profiles show the user's *current* time (not a message timestamp), so they use the ticking hook:

- `ProfileBadgeComponent` — `BadgePosition.END` badge via `addProfileBadge`, with a tooltip.
- `ProfileTimeSectionWrapper` — inline section injected by the profile patch.

Both use `useCurrentTimeFast` and respect `showOnProfile` / `showTzAbbrev`.

### Context Menu

The `user-context` menu item opens `TimezoneModal`, a `SearchableSelect` over `timezoneOptions`.
It shows a live preview of the current local time and offers a **Clear** action. Bots are skipped.

## Development Steps

1. `pnpm install --frozen-lockfile`
2. Edit `index.tsx` / `styles.css`
3. `pnpm build --dev`
4. `pnpm inject`

## Key Reference Files

| File | What to learn from |
|---|---|
| `src/plugins/userMessagesPronouns/index.ts` | Message patch find/match strings (normal + compact) |
| `src/plugins/userMessagesPronouns/PronounsChatComponent.tsx` | `timestampInline`/`timestamp` CSS classes, compact-mode handling |
| `src/plugins/messageLatency/index.tsx` | Message component patching, `ErrorBoundary.wrap` |
| `src/plugins/replyTimestamp/index.tsx` | Formatting a `message.timestamp` with `DateUtils`/`Timestamp` |
| `src/api/Badges.ts` | `addProfileBadge`, `ProfileBadge`, `BadgePosition` |
| `src/api/Settings.ts` | `definePluginSettings`, `OptionType` |
| `src/utils/types.ts` | `definePlugin`, `PluginDef` |

## Common Pitfalls

- **Fragile regex patches**: Discord updates frequently. Re-test all three patches after updates.
  Use `noWarn` to silence optional-patch warnings.
- **Message time must derive from `message.timestamp`**, never from `new Date()`. Using the current
  time makes every message show the same value instead of when it was sent.
- **No per-message interval**: message time is static; only profiles need a ticking hook.
- **DST correctness**: pass the relevant `Date` to `getTzAbbreviation` so abbreviations reflect the
  instant being displayed (e.g. `GMT+8` for a message date vs `CEST` now).
- **`Intl.supportedValuesOf` availability**: fall back to the curated list.
- **SSR / initial render**: profiles may not be loaded yet; components are wrapped in
  `ErrorBoundary` with `{ noop: true }`.

## Testing

1. Enable the plugin in Vencord settings → Plugins → UserTimeZone.
2. Right-click a user → **Set Timezone** → pick a timezone.
3. Compare the added message time against the message's own timestamp: it must be that instant
   converted to the assigned timezone (time only, no `GMT+X`).
4. Open the user's profile — badge + section show their *current* local time; toggle
   `showTzAbbrev` and confirm the suffix appears/disappears.
5. Toggle `use24h`, `showOnMessages`, `showOnProfile`.
6. Toggle compact message display and confirm the inline time still renders next to the username.
7. Disable the plugin and confirm everything returns to normal.

## Technical Notes

- **Why local storage instead of a server?** No backend needed; the user configures each person
  once. Trade-off: only the person who set it sees it.
- **Why `Intl` instead of `moment`?** Native, DST-correct, no dependency.
- **Why time-only on messages?** The adjacent Discord timestamp already conveys date/context; the
  added value is the remote clock time, so the suffix was removed for readability.
