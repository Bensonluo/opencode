import { Button } from "@opencode/ui/button"
import { useDialog } from "@opencode/ui/context/dialog"
import { Option } from "effect"
import { onMount } from "solid-js"
import { DialogBetaNotes } from "./beta-dialog"
import { sliceBetaNotes, type EmbeddedNotes } from "./beta-notes"

type Author = { name: string; login?: string; avatar?: string }

// Fictional people with drawn avatars, so the stories show no real names or photos.
const avatar = (hue: number) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="hsl(${hue} 45% 62%)"/><circle cx="24" cy="19" r="9" fill="hsl(${hue} 40% 88%)"/><rect x="9" y="32" width="30" height="20" rx="10" fill="hsl(${hue} 40% 88%)"/></svg>`,
  )}`

const people = {
  mira: { name: "Mira Okafor", login: "mira", avatar: avatar(18) },
  theo: { name: "Theo Lindqvist", login: "theo", avatar: avatar(205) },
  juno: { name: "Juno Park", login: "juno", avatar: avatar(140) },
  ravi: { name: "ravi-c", login: "ravi-c" },
  wren: { name: "Wren Abernathy", login: "wren", avatar: avatar(265) },
} satisfies Record<string, Author>

const commits: [
  type: "feat" | "fix" | "perf",
  scope: string,
  summary: string,
  pr: number | undefined,
  author: Author,
  description?: string,
][] = [
  [
    "fix",
    "app",
    "open select dialogs at the top",
    57101,
    people.theo,
    "Select dialogs used to open scrolled to the last item you picked. They now start at the top, with your pick still highlighted.",
  ],
  [
    "feat",
    "app",
    "merge projects across servers in the location dialog",
    57094,
    people.mira,
    "A project you open on two servers shows up once in the location dialog, with each server listed under it.",
  ],
  [
    "feat",
    "app",
    "open the right panel on a new tab",
    57090,
    people.juno,
    "New tabs open with the right panel showing, so changes and files are one glance away.",
  ],
  ["fix", "app", "open activity panel above the capsule", 57088, people.ravi],
  [
    "fix",
    "desktop",
    "disable animated wheel scrolling on linux",
    57080,
    people.wren,
    "Mouse wheels on Linux scroll in steps again. The smooth scrolling animation lagged behind the wheel on some drivers.",
  ],
  [
    "feat",
    "desktop",
    "pick models from a model dialog with favorites and recent",
    55838,
    people.theo,
    "Choosing a model opens a dialog with your favorites and recent models at the top, and search across every provider.",
  ],
  [
    "perf",
    "core",
    "cache the model list between sessions",
    57050,
    people.juno,
    "The model list loads from a local cache and refreshes in the background, so new sessions open without waiting on providers.",
  ],
  [
    "feat",
    "session-ui",
    "style markdown tables like generated UI tables",
    57002,
    people.mira,
    "Tables in replies share the look of generated UI tables: quieter borders, aligned numbers and a header that stays readable.",
  ],
  ["fix", "app", "fit connect dialog steps to their content under a fixed top edge", 57006, people.wren],
  [
    "feat",
    "app",
    "add an experimental session inbox to the sidebar",
    55647,
    people.ravi,
    "Turn on the session inbox under Experiments to see sessions that finished or need an answer in one place.",
  ],
  [
    "fix",
    "core",
    "debounce compatibility skill reloads",
    56260,
    people.theo,
    "Saving several skill files at once reloads skills once instead of once per file.",
  ],
  ["fix", "session-ui", "restore blue user bubbles with grey pending steers", 57001, people.mira],
  [
    "feat",
    "ui",
    "open images from their place in the message",
    56896,
    people.juno,
    "Clicking an image in a message grows it into the viewer from where it sat, and closing it puts it back.",
  ],
  [
    "fix",
    "desktop",
    "install each Windows channel into its own directory",
    56904,
    people.wren,
    "Beta and stable builds on Windows no longer overwrite each other's files.",
  ],
  ["feat", "app", "show MCP errors from a failed status link", undefined, people.ravi],
  ["fix", "ui", "open dialogs with their input focused", undefined, people.theo],
  [
    "fix",
    "app",
    "default agent notifications to off",
    56990,
    people.juno,
    "Agent notifications start off. Turn them on in Settings when you want a ping as agents finish.",
  ],
  [
    "feat",
    "app",
    "add Focus and Pro interface picker to preferences",
    56898,
    people.mira,
    "Preferences has a picker between Focus, which hides the side panels until you need them, and Pro, which keeps everything in view.",
  ],
]

const sha = (n: number) => n.toString(16).padStart(4, "0").padEnd(40, "a")

// A build's embedded history: one commit per entry, newest first, with a chore between the notes.
const embedded = (picked: typeof commits): EmbeddedNotes => ({
  sha: sha(1000),
  commits: [sha(1000), ...picked.flatMap((_, i) => [sha(i * 2 + 1), sha(i * 2 + 2)]), sha(999)].map((value) =>
    value.slice(0, 12),
  ),
  notes: picked.map(([type, scope, summary, pr, author, description], i) => ({
    type,
    scope,
    summary,
    pr,
    sha: sha(i * 2 + 1).slice(0, 12),
    author,
    description,
  })),
})

// What a build without GitHub access embeds: commit authors without avatars, and no descriptions.
const offline = (picked: typeof commits): typeof commits =>
  picked.map(([type, scope, summary, pr, author]) => [type, scope, summary, pr, { name: author.name }])

function Fixture(props: { picked: typeof commits; previous?: string; previousCommit?: string }) {
  const dialog = useDialog()
  const notes = Option.getOrThrow(sliceBetaNotes(embedded(props.picked), props.previousCommit ?? sha(999)))

  const open = () =>
    dialog.show(() => (
      <DialogBetaNotes
        notes={notes}
        previous={props.previous ?? "0.0.0-beta-21180"}
        dialog={{ close: () => dialog.close() }}
        open={(href) => window.open(href, "_blank")}
      />
    ))

  onMount(open)

  return <Button onClick={open}>Open What's new in beta</Button>
}

export default {
  title: "Extensions/Updater/What's new in beta",
  id: "extensions-updater-beta-notes",
  parameters: {
    docs: {
      description: {
        component:
          "The dialog a beta desktop build shows after an update: the features and fixes since the build the user last saw.",
      },
    },
  },
}

/** A typical update: a few features and fixes. */
export const Typical = { render: () => <Fixture picked={commits.slice(0, 8)} /> }

/** More than ten changes: the rest are linked on GitHub. */
export const Many = {
  render: () => <Fixture picked={commits} previous="0.0.0-beta-21012" />,
}

/** Built without GitHub: commit authors as initials, and the subjects alone. */
export const Offline = { render: () => <Fixture picked={offline(commits.slice(0, 8))} /> }

/** Only fixes, so the New section is not shown. */
export const FixesOnly = {
  render: () => <Fixture picked={commits.filter(([type]) => type === "fix").slice(0, 4)} />,
}

/** The previous build is older than the embedded history: the newest changes stand in, and the rest are linked. */
export const PreviousBuildUnknown = {
  render: () => <Fixture picked={commits} previous="0.0.0-beta-20500" previousCommit={sha(5000)} />,
}
