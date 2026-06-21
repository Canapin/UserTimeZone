/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { addProfileBadge, BadgePosition, ProfileBadge, removeProfileBadge } from "@api/Badges";
import { definePluginSettings } from "@api/Settings";
import { getUserSettingLazy } from "@api/UserSettings";
import ErrorBoundary from "@components/ErrorBoundary";
// import { Devs } from "@utils/constants";
import { classes } from "@utils/misc";
import definePlugin, { OptionType } from "@utils/types";
import type { Message } from "@vencord/discord-types";
import { findCssClassesLazy } from "@webpack";
import { Menu, Modal, openModal, React, SearchableSelect, Text, Tooltip, UserStore } from "@webpack/common";

const TimestampClasses = findCssClassesLazy("timestampInline", "timestamp");
const MessageDisplayCompact = getUserSettingLazy("textAndImages", "messageDisplayCompact")!;

function getTzAbbreviation(tz: string): string {
    try {
        const parts = new Intl.DateTimeFormat("en-US", {
            timeZone: tz,
            timeZoneName: "short"
        }).formatToParts(new Date());
        return parts.find(p => p.type === "timeZoneName")?.value ?? tz.split("/").pop() ?? tz;
    } catch {
        return tz.split("/").pop() ?? tz;
    }
}

function formatTime(tz: string, use24h: boolean, showAbbrev: boolean): string | null {
    try {
        const now = new Date();
        const timeStr = now.toLocaleTimeString("en-US", {
            timeZone: tz,
            hour: "2-digit",
            minute: "2-digit",
            hour12: !use24h
        });
        if (showAbbrev) {
            const abbrev = getTzAbbreviation(tz);
            return `${timeStr} ${abbrev}`;
        }
        return timeStr;
    } catch {
        return null;
    }
}

function getCommonTimezones() {
    let tzs: string[];
    try {
        tzs = Intl.supportedValuesOf("timeZone");
    } catch {
        tzs = [
            "UTC", "America/New_York", "America/Chicago", "America/Denver",
            "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu",
            "America/Phoenix", "America/Toronto", "America/Vancouver",
            "America/Mexico_City", "America/Sao_Paulo", "America/Argentina/Buenos_Aires",
            "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Madrid",
            "Europe/Rome", "Europe/Amsterdam", "Europe/Stockholm", "Europe/Moscow",
            "Europe/Istanbul", "Europe/Kyiv", "Europe/Helsinki", "Europe/Dublin",
            "Europe/Lisbon", "Europe/Zurich", "Europe/Vienna", "Europe/Prague",
            "Europe/Warsaw", "Europe/Budapest", "Europe/Athens", "Europe/Bucharest",
            "Africa/Cairo", "Africa/Casablanca", "Africa/Johannesburg", "Africa/Lagos",
            "Asia/Dubai", "Asia/Karachi", "Asia/Kolkata", "Asia/Dhaka",
            "Asia/Bangkok", "Asia/Singapore", "Asia/Shanghai", "Asia/Tokyo",
            "Asia/Seoul", "Asia/Hong_Kong", "Asia/Taipei", "Asia/Jakarta",
            "Asia/Manila", "Asia/Jerusalem", "Asia/Riyadh", "Asia/Tehran",
            "Australia/Sydney", "Australia/Melbourne", "Australia/Perth",
            "Australia/Brisbane", "Australia/Adelaide", "Pacific/Auckland",
            "Pacific/Fiji", "Pacific/Guam"
        ];
    }
    return tzs.map(tz => ({
        label: `(${getTzAbbreviation(tz)}) ${tz.replace(/_/g, " ")}`,
        value: tz,
        default: tz === "UTC"
    }));
}

const timezoneOptions = getCommonTimezones();

const settings = definePluginSettings({
    userTimezones: {
        type: OptionType.CUSTOM,
        default: {} as Record<string, string>,
    },
    showOnProfile: {
        type: OptionType.BOOLEAN,
        description: "Show local time on user profiles",
        default: true
    },
    showOnMessages: {
        type: OptionType.BOOLEAN,
        description: "Show local time on messages",
        default: true
    },
    use24h: {
        type: OptionType.BOOLEAN,
        description: "Use 24-hour time format",
        default: false
    },
    showTzAbbrev: {
        type: OptionType.BOOLEAN,
        description: "Show timezone abbreviation (e.g., CEST)",
        default: true
    }
});

function getUserTimezone(userId: string): string | null {
    return (settings.store as any).userTimezones?.[userId] ?? null;
}

function setUserTimezone(userId: string, tz: string | null): void {
    const tzs = { ...((settings.store as any).userTimezones ?? {}) };
    if (tz) tzs[userId] = tz;
    else delete tzs[userId];
    (settings.store as any).userTimezones = tzs;
}

function useCurrentTime(tz: string | null, use24h: boolean, showAbbrev: boolean): string | null {
    const [time, setTime] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!tz) {
            setTime(null);
            return;
        }
        const update = () => setTime(formatTime(tz, use24h, showAbbrev));
        update();
        const interval = setInterval(update, 30000);
        return () => clearInterval(interval);
    }, [tz, use24h, showAbbrev]);

    return time;
}

function useCurrentTimeFast(tz: string | null, use24h: boolean, showAbbrev: boolean): string | null {
    const [time, setTime] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!tz) {
            setTime(null);
            return;
        }
        const update = () => setTime(formatTime(tz, use24h, showAbbrev));
        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    }, [tz, use24h, showAbbrev]);

    return time;
}

function TimezoneModal({ user, transitionState, onClose }: any) {
    const current = getUserTimezone(user.id);
    const preview = current ? formatTime(current, settings.store.use24h, settings.store.showTzAbbrev) : null;

    return (
        <Modal
            transitionState={transitionState}
            onClose={onClose}
            title={`Timezone for ${user.globalName ?? user.username}`}
            actions={current ? [{
                text: "Clear",
                variant: "secondary",
                onClick() {
                    setUserTimezone(user.id, null);
                    onClose();
                }
            }] : []}
        >
            {preview && (
                <Text variant="text-sm/normal" style={{ marginBottom: "16px" }}>
                    Current local time: {preview}
                </Text>
            )}
            <SearchableSelect
                placeholder="Search timezone..."
                options={timezoneOptions}
                value={current ?? undefined}
                onChange={v => {
                    if (v) {
                        setUserTimezone(user.id, v);
                        onClose();
                    }
                }}
                maxVisibleItems={10}
                closeOnSelect
            />
        </Modal>
    );
}

function openTimezoneModal(user: any) {
    openModal(props => <TimezoneModal user={user} {...props} />);
}

function shouldShowMessage(message: Message): boolean {
    if (message.author?.bot || message.author?.system) return false;
    if (!settings.store.showOnMessages) return false;
    return true;
}

function MessageTimeComponent({ message }: { message: Message }) {
    const tz = getUserTimezone(message.author.id);
    const time = useCurrentTime(tz, settings.store.use24h, settings.store.showTzAbbrev);
    if (!time) return null;

    return (
        <span className={classes(TimestampClasses.timestampInline, TimestampClasses.timestamp, "vc-utz-message")}>
            {" "}• 🕐 {time}
        </span>
    );
}

const MessageTimeWrapper = ErrorBoundary.wrap(
    ({ message }: { message: Message }) =>
        shouldShowMessage(message) ? <MessageTimeComponent message={message} /> : null,
    { noop: true }
);

const CompactMessageTimeWrapper = ErrorBoundary.wrap(
    ({ message }: { message: Message }) => {
        const compact = MessageDisplayCompact.useSetting();
        if (!compact || !shouldShowMessage(message)) return null;
        return <MessageTimeComponent message={message} />;
    },
    { noop: true }
);

function ProfileBadgeComponent({ userId }: { userId: string }) {
    const tz = getUserTimezone(userId);
    const time = useCurrentTimeFast(tz, settings.store.use24h, settings.store.showTzAbbrev);
    if (!time || !settings.store.showOnProfile) return null;

    return (
        <Tooltip text={`Local time: ${time}`}>
            {tooltipProps => (
                <span
                    {...tooltipProps}
                    className="vc-utz-badge"
                    role="img"
                    aria-label={`Local time: ${time}`}
                >
                    🕐{time}
                </span>
            )}
        </Tooltip>
    );
}

function ProfileTimeSectionWrapper({ userId }: { userId: string }) {
    const tz = getUserTimezone(userId);
    const time = useCurrentTimeFast(tz, settings.store.use24h, settings.store.showTzAbbrev);
    if (!time || !settings.store.showOnProfile) return null;

    return (
        <div className="vc-utz-profile-section">
            🕐 {time}
        </div>
    );
}

const ProfileTimeSection = ErrorBoundary.wrap(ProfileTimeSectionWrapper, { noop: true });

const ProfileBadgeWrapped = ErrorBoundary.wrap(ProfileBadgeComponent, { noop: true });

const profileBadge: ProfileBadge = {
    id: "user-timezone",
    component: ProfileBadgeWrapped as any,
    position: BadgePosition.END,
    shouldShow: () => settings.store.showOnProfile
};

export default definePlugin({
    name: "UserTimeZone",
    description: "Set per-user timezones via right-click → Set Timezone. Shows local time on profiles and messages.",
    tags: ["Utility", "Customisation"],
    authors: [{ name: "Coin-coin le Canapin", id: 0n }],

    settings,
    settingsAboutComponent: function SettingsPage() {
        const tzs = (settings.store as any).userTimezones ?? {};
        const entries = Object.entries(tzs) as [string, string][];

        return (
            <>
                <Text variant="heading-lg/semibold" style={{ marginBottom: "16px" }}>
                    User Timezones ({entries.length} configured)
                </Text>
                {entries.length === 0 && (
                    <Text variant="text-sm/normal">
                        No timezones configured yet. Right-click a user and select "Set Timezone" to add one.
                    </Text>
                )}
                {entries.map(([userId, tz]) => {
                    const user = UserStore.getUser(userId);
                    const name = user?.globalName ?? user?.username ?? userId;
                    const time = formatTime(tz, settings.store.use24h, settings.store.showTzAbbrev);
                    return (
                        <div className="vc-utz-settings-user" key={userId}>
                            <Text variant="text-sm/normal">{name}</Text>
                            <Text variant="text-xs/normal" style={{ color: "var(--text-muted)" }}>
                                {tz} — {time}
                            </Text>
                        </div>
                    );
                })}
            </>
        );
    },

    patches: [
        {
            find: "showCommunicationDisabledStyles",
            replacement: {
                match: /(?<=return\s*\(0,\i\.jsxs?\)\(.+!\i&&)(\(0,\i.jsxs?\)\(.+?\{.+?\}\))/,
                replace: "[$1, $self.MessageTimeWrapper(arguments[0])]"
            }
        },
        {
            find: '="SYSTEM_TAG"',
            replacement: [
                {
                    match: /className:\i\(\)\(\i\.className(?:,\i\.\i)?,\i\)\}\)(?:\))?,(?=\i)/g,
                    replace: "$&$self.CompactMessageTimeWrapper(arguments[0]),"
                }
            ]
        },
        {
            find: "#{intl::USER_PROFILE_PRONOUNS}",
            replacement: {
                match: /(?<=\[)(?=\i," ",\i)/,
                replace: "$self.ProfileTimeSection({userId:arguments[0]?.user?.id}),"
            }
        }
    ],

    MessageTimeWrapper,
    CompactMessageTimeWrapper,
    ProfileTimeSection,

    contextMenus: {
        "user-context": (children, { user }) => {
            if (!user || user.bot) return;
            const currentTz = getUserTimezone(user.id);
            const label = currentTz
                ? `${currentTz.replace(/_/g, " ")} — ${formatTime(currentTz, settings.store.use24h, settings.store.showTzAbbrev) ?? ""}`
                : "Set Timezone";
            children.push(
                <Menu.MenuItem
                    id="vc-utz-set"
                    label={label}
                    action={() => openTimezoneModal(user)}
                />
            );
        }
    },

    start() {
        addProfileBadge(profileBadge);
    },

    stop() {
        removeProfileBadge(profileBadge);
    }
});
