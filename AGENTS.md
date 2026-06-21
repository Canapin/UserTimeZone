# Vencord Plugin: UserTimeZone

## Goal

Build a Vencord plugin that lets users set a per-user timezone, displayed as local time on the user's profile (next to their username) and inline on their messages (next to the timestamp).

## Architecture

### Overview

The plugin uses **invisible Unicode tag character encoding** in the user's bio (same technique as `FakeProfileThemes`) to share timezone data without a backend. When User A sets "Europe/Berlin", the plugin encodes it as invisible chars and prepends it to A's bio. User B (with the plugin) decodes it and sees A's local time.

### Files

```
src/plugins/userTimeZone/
├── index.tsx        # Plugin entry: definePlugin, patches, components
├── styles.css       # Styling for message & profile time indicators
├── README.md        # Documentation + usage instructions
└── AGENTS.md        # This file — instructions for AI agents
```

### Plugin Definition (index.tsx)

```ts
export default definePlugin({
    name: "UserTimeZone",
    description: "Shows each user's local time on their profile and messages via bio-encoded timezone",
    tags: ["Utility", "Customisation"],
    authors: [Devs.YourName],
    patches: [...],
    settings: definePluginSettings({...}),
    settingsAboutComponent: SettingsComponent,
})
```

### Key Functions

| Function | Purpose |
|---|---|
| `encode(tz: string): string` | IANA timezone → invisible tag chars |
| `decode(bio: string): string \| null` | Extract IANA timezone from bio |
| `getLocalTime(tz: string, use24h: boolean): string` | Format current time in given tz |
| `getTzAbbreviation(tz: string): string` | Get short TZ name (e.g., "CEST") |

### Encoding Scheme (same as FakeProfileThemes)

Uses Unicode tag characters (U+E0000 range). Each ASCII char < 0x7F maps to `char + 0xE0000`.
The timezone string is wrapped in a marker like `[tz:America/New_York]` before encoding,
so the decoder can distinguish it from other encoded data in the bio.

```ts
const MARKER_START = "[tz:";
const MARKER_END = "]";

function encode(tz: string): string {
    const msg = MARKER_START + tz + MARKER_END;
    return Array.from(msg)
        .map(c => c.codePointAt(0)!)
        .filter(cp => cp >= 0x20 && cp <= 0x7f)
        .map(cp => String.fromCodePoint(cp + 0xE0000))
        .join("");
}

function decode(bio: string): string | null {
    if (!bio) return null;
    const marker = [...MARKER_START].map(c => String.fromCodePoint(c.codePointAt(0)! + 0xE0000)).join("");
    const end = [...MARKER_END].map(c => String.fromCodePoint(c.codePointAt(0)! + 0xE0000)).join("");
    const regex = new RegExp(`${marker}([\\uE0000-\\uE007F]+?)${end}`);
    const match = bio.match(regex);
    if (!match) return null;
    return [...match[1]]
        .map(c => String.fromCodePoint(c.codePointAt(0)! - 0xE0000))
        .join("");
}
```

### Timezone Data

Use `Intl.supportedValuesOf("timeZone")` when available (modern browsers/Chrome). Fall back to a curated list of ~50 common IANA timezones.

Formatting: use `Intl.DateTimeFormat` with the resolved timezone:

```ts
function getLocalTime(tz: string, use24h: boolean): string {
    const now = new Date();
    const timeStr = now.toLocaleTimeString("en-US", {
        timeZone: tz,
        hour: "2-digit",
        minute: "2-digit",
        hour12: !use24h
    });
    return timeStr;
}
```

### Settings

| Key | Type | Default | Description |
|---|---|---|---|
| `timezone` | SELECT (from timezone list) | `"UTC"` | Your IANA timezone |
| `showOnProfile` | BOOLEAN | `true` | Show local time on profiles |
| `showOnMessages` | BOOLEAN | `true` | Show local time on messages |
| `use24h` | BOOLEAN | `false` | 24-hour time format |
| `showTzAbbrev` | BOOLEAN | `true` | Show timezone abbreviation (e.g., "CEST") |

### Message Patch

Use the same target as `userMessagesPronouns` and `messageLatency`:

```ts
patches: [
    {
        find: "showCommunicationDisabledStyles",
        replacement: {
            match: /(?<=return\s*\(0,\i\.jsxs?\)\(.+!\i&&)(\(0,\i.jsxs?\)\(.+?\{.+?\}\))/,
            replace: "[$1, $self.MessageTimeWrapper(arguments[0])]"
        }
    },
    // Profile patch - inject timezone near username in profile header
    {
        find: ".displayName,",
        replacement: {
            match: /(\i)\.displayName/,
            replace: "$self.maybeInjectTimezone($1)??$&"
        }
    }
]
```

### Profile Display Component

Create a component that shows "🕐 3:42 PM" or "3:42 PM CEST" next to the user's name in the profile modal. Hook into `UserProfileStore` to decode the timezone from the user's bio, similar to `FakeProfileThemes`.

```ts
const UserTZBadge: React.FC<{ userId: string; }> = ({ userId }) => {
    const profile = UserProfileStore.getUserProfile(userId);
    const tz = profile ? decodeTimezone(profile.bio) : null;
    if (!tz) return null;
    const time = getLocalTime(tz, settings.use24h);
    const abbrev = settings.showTzAbbrev ? ` ${getTzAbbreviation(tz)}` : "";
    return <span className="vc-utz-profile">🕐 {time}{abbrev}</span>;
};
```

### Message Display Component

Shows a small inline text like "🕐 3:42 PM" next to the message timestamp. Uses the same CSS classes as the pronouns plugin for proper alignment.

```ts
const TimestampClasses = findCssClassesLazy("timestampInline", "timestamp");

const MessageTimeComponent: React.FC<{ message: Message; }> = ({ message }) => {
    const tz = decodeTimezoneFromMessage(message);
    if (!tz) return null;
    const time = getLocalTime(tz, settings.use24h);
    return <span className={TimestampClasses.timestamp}> • 🕐 {time}</span>;
};
```

## Development Steps

### 1. Setup
```bash
git clone https://github.com/Vendicated/Vencord.git
cd Vencord
pnpm install --frozen-lockfile
```

### 2. Create Plugin
- Create `src/plugins/userTimeZone/index.tsx`
- Create `src/plugins/userTimeZone/styles.css`
- Create `src/plugins/userTimeZone/README.md`

### 3. Implement encode/decode
- Copy encoding pattern from `src/plugins/fakeProfileThemes/index.tsx`
- Adapt for timezone strings instead of hex colors

### 4. Implement settings
- Add timezone selector (use `Intl.supportedValuesOf` or curated list)
- Add toggle options for profile/message display, 24h format

### 5. Implement patches
- `UserProfileStore.getUserProfile` patch to decode timezone
- Message timestamp patch (from Pronouns plugin pattern)
- Profile header patch to inject timezone element near username

### 6. Implement components
- Profile timezone badge/indicator
- Message timezone inline indicator
- Settings panel component with timezone picker and preview

### 7. Style
- Add `.vc-utz-profile` and `.vc-utz-message` CSS classes
- Match Discord's timestamp styling for seamless integration

### 8. Build & Test
```bash
pnpm build --dev
pnpm inject
```

## Key Reference Files

| File | What to learn from |
|---|---|
| `src/plugins/fakeProfileThemes/index.tsx` | Bio encoding/decoding, `getUserProfile` hook, settings UI |
| `src/plugins/friendsSince/index.tsx` | Profile modal patching, Section component |
| `src/plugins/userMessagesPronouns/index.ts` | Message timestamp inline injection, compact mode |
| `src/plugins/userMessagesPronouns/PronounsChatComponent.tsx` | Timestamp CSS classes, tooltip usage |
| `src/plugins/messageLatency/index.tsx` | Message component patching pattern |
| `src/plugins/replyTimestamp/index.tsx` | Timestamp formatting with DateUtils |
| `src/utils/types.ts` | `definePlugin`, `OptionType`, `Patch`, `PluginDef` types |
| `src/api/Settings.ts` | `definePluginSettings` |

## Common Pitfalls

- **Fragile regex patches**: Discord updates frequently. Test patches after each update. Use `noWarn` to silence optional patch warnings.
- **Bio length limits**: Discord bios have a max length. Keep padding minimal.
- **Performance**: `Intl.DateTimeFormat` is expensive in a hot loop. Cache formatters per timezone.
- **Timezones not available**: `Intl.supportedValuesOf` is Chrome 74+/Node 22+. Check availability.
- **SSR / initial render**: User profiles may not be loaded yet. Use `useStateFromStores` or `useAwaiter`.
- **Multiple encodings**: If both FakeProfileThemes and UserTimeZone are active, ensure markers are unique (`[tz:...]` vs `[#color,#color]`).

## Testing

1. Enable the plugin in Vencord settings > Plugins > UserTimeZone
2. Set your timezone in the plugin settings
3. Open your own profile — should show "🕐 3:42 PM" near your username
4. Send a message — should show "🕐 3:42 PM" next to the message timestamp
5. Ask a friend with the plugin installed to check your profile/messages
6. Change your timezone in settings and verify it updates everywhere
7. Toggle 24h format and verify
8. Disable the plugin and verify everything returns to normal

## Technical Notes

- **Why bio encoding instead of server?** No backend needed, zero setup for users, works "virally" like FakeProfileThemes
- **Why `Intl.DateTimeFormat` vs `moment`?** Vencord already has moment as a dep but `Intl` is native and handles DST correctly
- **Why tag characters?** They're invisible in Discord's UI, pass through the backend intact, and can be mixed with normal text
