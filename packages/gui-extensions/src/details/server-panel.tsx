import { Popover } from "@kobalte/core/popover"
import { Icon } from "@opencode/ui/icon"
import { showToast } from "@opencode/ui/toast"
import { Tooltip } from "@opencode/ui/tooltip"
import { TruncatedText } from "@opencode/ui/truncated-text"
import { getDirectory } from "@opencode/util/path"
import { children, createMemo, createSignal, For, Index, on, onCleanup, Show, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { useDrawer, useExtension, type MountedSession } from "../sdk"
import { McpServerControl, useConfig, useMcpRow, useMcpServers, useMcpToggle, usePlugins, useSkills } from "./services"

const services = [
  { type: "mcp", icon: "mcp", label: "mcp" },
  { type: "plugins", icon: "cube", label: "plugins" },
  { type: "skills", icon: "graduation-cap", label: "skills" },
  { type: "lsp", icon: "code-slash", label: "lsp" },
] as const

type Service = (typeof services)[number]["type"]

type ServiceMenuProps = {
  session: MountedSession
  service: (typeof services)[number]
  directory: string
  shown: boolean
  open: boolean
  mobile?: boolean
  onOpenChange: (open: boolean) => void
}

export function SessionServerPanel(props: {
  session: MountedSession
  directory: string
  shown: boolean
  mobile?: boolean
}) {
  const ctx = useExtension()
  const name = () => (ctx.servers.list().length < 2 ? ctx.t("server") : props.session.server.name)
  // A new scope whenever the location or visibility changes closes the service popover.
  const scope = createMemo(on([() => props.directory, () => props.shown], () => ({})))
  const [submenu, setSubmenu] = createSignal<{ readonly scope: object; readonly service: Service }>()

  const open = () => {
    const current = submenu()

    return current?.scope === scope() ? current.service : undefined
  }

  return (
    <section class="session-summary-card" data-section="server">
      <h2 class="session-summary-row session-summary-heading">
        <span dir="auto" class="session-summary-label">
          {name()}
        </span>
      </h2>
      <Show when={props.directory} keyed>
        {(directory) => (
          <div class="session-summary-rows">
            <For each={services}>
              {(service) => (
                <ServiceMenu
                  session={props.session}
                  service={service}
                  directory={directory}
                  shown={props.shown}
                  open={open() === service.type}
                  mobile={props.mobile}
                  onOpenChange={(value) => setSubmenu(value ? { scope: scope(), service: service.type } : undefined)}
                />
              )}
            </For>
          </div>
        )}
      </Show>
    </section>
  )
}

function ServiceMenu(props: ServiceMenuProps) {
  if (props.service.type === "mcp") return <McpMenu {...props} />

  if (props.service.type === "lsp") return <LspMenu {...props} />

  return <ServiceCatalog {...props} />
}

function LspMenu(props: ServiceMenuProps) {
  const ctx = useExtension()
  const config = useConfig(source(props))

  return (
    <ServicePopover
      {...props}
      loading={config.loading()}
      ready={config.ready()}
      empty={config.lsps().length === 0}
      error={config.error()}
      retry={config.retry}
    >
      <Show
        when={config.lsps().length}
        fallback={
          <ServiceEmpty session={props.session} title={ctx.t("lsp.empty")} directory={props.directory} service="lsp" />
        }
      >
        <h3 class="session-service-title">{ctx.t("lsp.configured")}</h3>
        <For each={config.lsps()}>
          {(name) => (
            <div class="session-service-row">
              <span dir="auto" class="session-summary-label">
                {name}
              </span>
            </div>
          )}
        </For>
        <div class="session-service-footer">
          <ServiceConfigLink session={props.session} directory={props.directory} service="lsp" />
        </div>
      </Show>
    </ServicePopover>
  )
}

function McpMenu(props: ServiceMenuProps) {
  const ctx = useExtension()
  const toggle = useMcpToggle(props.session, () => props.directory)
  const servers = useMcpServers(source(props))

  return (
    <ServicePopover
      {...props}
      loading={servers.loading()}
      ready={servers.ready()}
      empty={servers.list().length === 0}
      error={servers.error()}
      retry={servers.retry}
    >
      <Show
        when={servers.list().length}
        fallback={
          <ServiceEmpty session={props.session} title={ctx.t("mcp.empty")} directory={props.directory} service="mcp" />
        }
      >
        <h3 class="session-service-title">{ctx.t("mcp.title")}</h3>
        <Index each={servers.list()}>
          {(server) => {
            const row = useMcpRow({ session: props.session, directory: props.directory, server, toggle })

            return (
              <div class="session-mcp-row" data-disabled={row.pending() || undefined} onClick={row.follow}>
                <span class="session-mcp-name">
                  <span class="session-service-dot" data-status={server().status.status} aria-hidden="true" />
                  <TruncatedText text={server().name} class="session-summary-label" />
                </span>
                {/* Status stays beside its control rather than competing with a long server name. */}
                <span class="session-mcp-trailing" onClick={(event) => event.stopPropagation()}>
                  <Show when={row.failed()}>
                    <span class="session-mcp-failed">{ctx.t("failed")}</span>
                  </Show>
                  <McpServerControl server={server()} row={row} />
                </span>
              </div>
            )
          }}
        </Index>
        <div class="session-service-footer">
          <ServiceConfigLink session={props.session} directory={props.directory} service="mcp" />
          <button
            type="button"
            class="session-service-config"
            onClick={() => {
              props.onOpenChange(false)
              ctx.layout.command("mcp.toggle")
            }}
          >
            <Icon name="mcp" class="shrink-0 text-v2-icon-icon-muted" />
            <span class="min-w-0 truncate">{ctx.t("mcp.manage")}</span>
          </button>
        </div>
      </Show>
    </ServicePopover>
  )
}

function ServiceCatalog(props: ServiceMenuProps) {
  const ctx = useExtension()
  const catalog = props.service.type === "plugins" ? usePlugins(source(props)) : useSkills(source(props))

  return (
    <ServicePopover
      {...props}
      loading={catalog.loading()}
      ready={catalog.ready()}
      empty={catalog.list().length === 0}
      error={catalog.error()}
      retry={catalog.retry}
    >
      <Show
        when={catalog.list().length}
        fallback={
          <ServiceEmpty
            session={props.session}
            title={ctx.t(props.service.type === "plugins" ? "plugins.empty" : "skills.empty")}
            directory={props.directory}
            service={props.service.type}
          />
        }
      >
        <h3 class="session-service-title">
          {ctx.t(props.service.type === "plugins" ? "plugins.configured" : "skills.configured")}
        </h3>
        <For each={catalog.list()}>
          {(item) => (
            <div class="session-service-row" title={item.error ?? item.name}>
              <span class="session-service-dot" data-status={item.status} aria-hidden="true" />
              <span dir="auto" class="session-summary-label">
                {item.name}
              </span>
              <Show when={item.status === "failed"}>
                <span class="session-service-status">{ctx.t("failed")}</span>
              </Show>
            </div>
          )}
        </For>
        <div class="session-service-footer">
          <ServiceConfigLink session={props.session} directory={props.directory} service={props.service.type} />
        </div>
      </Show>
    </ServicePopover>
  )
}

function source(props: ServiceMenuProps) {
  return { session: () => props.session, directory: () => props.directory, shown: () => props.shown }
}

type ServiceBodyProps = {
  loading: boolean
  ready: boolean
  error: unknown
  retry: () => void
  children: JSX.Element
}

function ServicePopover(props: ServiceMenuProps & ServiceBodyProps & { empty: boolean }) {
  const ctx = useExtension()
  const locale = ctx.locale
  const drawer = useDrawer()

  const placement = createMemo(() =>
    props.mobile ? "top-end" : locale.direction() === "rtl" ? "right-start" : "left-start",
  )

  // How the trigger last opened the menu: a keyboard open moves focus to the first row, a pointer open does not.
  const opening = { pointer: false }

  // In a narrow-screen drawer the service list replaces the drawer's view instead of opening a popover over it.
  if (props.mobile && drawer) {
    const content = children(() => (
      <div
        class="session-summary-card session-service-drawer"
        data-service={props.service.type}
        aria-busy={props.loading}
      >
        <ServiceBody {...props} />
      </div>
    ))

    return (
      <button
        type="button"
        class="session-summary-row"
        onClick={(event) => {
          if (!props.loading) void props.retry()
          drawer.open({ title: ctx.t(props.service.label), content: content(), trigger: event.currentTarget })
        }}
      >
        <Icon name={props.service.icon} class="shrink-0 text-v2-icon-icon-muted" />
        <span class="session-summary-label">{ctx.t(props.service.label)}</span>
        <Icon name="chevron-right" class="session-summary-menu-indicator shrink-0 text-v2-icon-icon-muted" />
      </button>
    )
  }

  return (
    <Popover
      open={props.open}
      onOpenChange={(open) => {
        props.onOpenChange(open)

        if (open && !props.loading) void props.retry()
      }}
      placement={placement()}
      gutter={4}
      overflowPadding={16}
      modal={false}
    >
      <Popover.Trigger
        as="button"
        type="button"
        class="session-summary-row"
        onPointerDown={() => (opening.pointer = true)}
        onKeyDown={() => (opening.pointer = false)}
      >
        <Icon name={props.service.icon} class="shrink-0 text-v2-icon-icon-muted" />
        <span class="session-summary-label">{ctx.t(props.service.label)}</span>
        <Icon name="fill-triangle-down" class="session-summary-menu-indicator shrink-0 text-v2-icon-icon-muted" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          class="session-service-menu"
          data-service={props.service.type}
          data-empty={(props.ready && !props.error && props.empty) || undefined}
          aria-busy={props.loading}
          aria-label={ctx.t(props.service.label)}
          // A pointer open focuses the menu itself, as the browser site panel does, so its first row shows no ring.
          onOpenAutoFocus={(event: Event) => {
            if (!opening.pointer) return
            event.preventDefault()

            const content = event.currentTarget

            // Deferred like Kobalte's own autofocus: focusing now, before this nested layer registers, reads as focus
            // leaving the details panel and closes it.
            if (content instanceof HTMLElement) setTimeout(() => content.focus({ preventScroll: true }))
          }}
        >
          <ServiceBody {...props} />
        </Popover.Content>
      </Popover.Portal>
    </Popover>
  )
}

function ServiceBody(props: ServiceBodyProps) {
  const ctx = useExtension()

  return (
    <Show
      when={props.ready || !props.loading}
      fallback={
        <div class="session-service-message" role="status">
          {ctx.t("common.loading")}
        </div>
      }
    >
      <Show
        when={!props.error}
        fallback={
          <div class="session-service-message" role="alert">
            <p>{ctx.t("common.requestFailed")}</p>
            <button type="button" class="session-summary-row" onClick={() => props.retry()}>
              {ctx.t("retry")}
            </button>
          </div>
        }
      >
        {props.children}
      </Show>
    </Show>
  )
}

function ServiceConfigLink(props: { session: MountedSession; directory: string; service: Service }) {
  const ctx = useExtension()
  const desktop = ctx.desktop
  const system = ctx.system
  const local = () => props.session.server.local
  const [store, setStore] = createStore({ opening: false, copied: false })
  const label = () => ctx.t(local() ? "configure" : "copyConfigPath")
  // Clears the copied mark two seconds after the latest copy.
  let reset: ReturnType<typeof setTimeout> | undefined

  onCleanup(() => clearTimeout(reset))

  const activate = async () => {
    if (store.opening || (local() && !desktop)) return
    setStore({ opening: true, copied: false })
    const directory = props.directory
    await props.session.server.client.config
      .get({ location: { directory } })
      .then(async (entries) => {
        const documents = entries
          .filter((entry) => entry.type === "document")
          .filter((entry) => entry.path !== undefined && /\.jsonc?$/.test(entry.path))

        const path =
          documents.findLast((entry) => entry.info[props.service] !== undefined)?.path ?? documents.at(-1)?.path

        if (!local()) {
          if (!path) throw new Error(ctx.t("configFileMissing"))
          await system.copy(path)
          setStore("copied", true)
          clearTimeout(reset)
          reset = setTimeout(() => setStore("copied", false), 2000)

          return
        }

        if (path && (await desktop?.reveal(path))) return
        await desktop?.launch(path ? getDirectory(path) : directory)
      })
      .catch((error) =>
        showToast({
          variant: "error",
          title: ctx.t("common.requestFailed"),
          description: error instanceof Error ? error.message : String(error),
        }),
      )
      .finally(() => setStore("opening", false))
  }

  return (
    <>
      <span class="session-service-config-separator" role="separator" />
      <Show
        when={!local() || desktop}
        fallback={
          <span class="session-service-row">
            <Icon name="settings-gear" class="shrink-0 text-v2-icon-icon-muted" />
            {label()}
          </span>
        }
      >
        <Tooltip
          inactive={local()}
          value={ctx.t(store.copied ? "ui.message.copied" : "ui.message.copy")}
          placement="top"
          getAnchorRect={(anchor) => anchor?.querySelector("svg")?.getBoundingClientRect()}
          forceOpen={store.copied ? true : undefined}
          class="w-full"
        >
          <button
            type="button"
            class="session-service-config"
            disabled={store.opening}
            onMouseDown={(event) => {
              if (!local()) event.preventDefault()
            }}
            onClick={() => void activate()}
          >
            <Icon
              name={local() ? "settings-gear" : store.copied ? "check" : "outline-copy"}
              class="shrink-0 text-v2-icon-icon-muted"
            />
            <span class="session-summary-label">{label()}</span>
            <Show when={local()}>
              <Icon name="arrow-up-right" class="session-service-config-arrow shrink-0" />
            </Show>
          </button>
        </Tooltip>
      </Show>
    </>
  )
}

function ServiceEmpty(props: { session: MountedSession; title: string; directory: string; service: Service }) {
  return (
    <div class="session-service-empty">
      <strong>{props.title}</strong>
      <div class="session-service-footer">
        <ServiceConfigLink session={props.session} directory={props.directory} service={props.service} />
      </div>
    </div>
  )
}
