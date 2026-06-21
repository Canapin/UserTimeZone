# UserTimeZone

A Vencord/Vesktop plugin that shows each user's local time on their profile and messages.

Set a per-user timezone via right-click → Set Timezone. Timezones are stored locally on your machine.

## Features

- **Right-click** any user → **Set Timezone** (searchable dropdown, auto-saves)
- Shows current local time **on profiles** (above the name area + badge next to username)
- Shows current local time **inline next to message timestamps** (normal + compact mode)
- 12h/24h format toggle
- Timezone abbreviation display (CEST, EST, etc.)
- All timezones stored **locally** — no server, no bios, no sharing

## Installation

### Prerequisites

- Vencord built from source ([guide](https://docs.vencord.dev/installing/))
- Vesktop or Discord Desktop

### Quick install

```bash
# Clone into your userplugins folder
cd /path/to/Vencord/src/userplugins
git clone https://github.com/Canapin/UserTimeZone.git

# Rebuild Vencord
cd /path/to/Vencord
pnpm build --dev
```

Then restart Vesktop / reinject Discord.

### Dev mode (auto-reload)

```bash
pnpm build --dev --watch
# Ctrl+R in Vesktop to reload after changes
```

## Usage

1. Enable the plugin in Vencord Settings → Plugins → UserTimeZone
2. Right-click any user → **Set Timezone** → type to search (e.g. "hong" finds Hong Kong)
3. Their local time now appears on their messages and profile
4. Manage all configured timezones in the plugin settings page
5. Right-click again to **Clear** a timezone

## Files

```
userTimeZone/
├── index.tsx        # Plugin entry point
├── styles.css       # Styling
├── README.md        # This file
└── AGENTS.md        # AI agent instructions for development
```

## Compatibility

- **Vesktop** ✓
- **Discord Desktop** ✓
- **Web/Browser** ✓ (untested but should work)
