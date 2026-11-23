import { expect, test } from "bun:test"
import { createAppFixture } from "./fixture/app"
import { directory, json } from "./fixture/tui-client"

// Regression: the environment effect tracks the session record, and a record refresh is not a
// reason to post again. Another terminal's prompt resyncs the record in every terminal that has
// the session open, so an idle terminal used to overwrite the environment of the terminal that
// sent the prompt (#65883). A reconnect still posts again, because the server may have restarted.

const session = {
  id: "ses_environment",
  title: "Environment",
  projectID: "proj_test",
  location: { directory },
  cost: 0,
  tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
  time: { created: 0, updated: 0 },
}

test("an idle terminal posts its environment once per connection", async () => {
  const posted: Array<Record<string, string>> = []
  const first = Promise.withResolvers<void>()
  const resync = Promise.withResolvers<void>()
  const reconnected = Promise.withResolvers<void>()
  let reads = 0
  await using setup = await createAppFixture({
    config: { animations: false, tabs: { enabled: false } },
    args: { sessionID: session.id },
    environment: { PROBE: "idle" },
    fetch: async (url, request) => {
      if (url.pathname === `/api/session/${session.id}/environment`) {
        const body = (await request.json()) as { variables: Record<string, string> }
        posted.push(body.variables)
        if (posted.length === 1) first.resolve()
        if (posted.length === 2) reconnected.resolve()
        return new Response(null, { status: 204 })
      }
      if (url.pathname === "/api/session") return json({ data: [session], cursor: {} })
      if (url.pathname === `/api/session/${session.id}/inbox`) return json({ data: [] })
      if (url.pathname === `/api/session/${session.id}/message`) return json({ data: [], cursor: {} })
      if (url.pathname === `/api/session/${session.id}`) {
        if (++reads === 2) resync.resolve()
        return json({ data: session })
      }
      return undefined
    },
  })
  await setup.ready
  await first.promise
  expect(posted).toEqual([{ PROBE: "idle" }])

  // What the terminal that sends a prompt triggers in every other terminal.
  setup.events.emit({
    id: "evt_execution",
    created: 1,
    type: "session.execution.started",
    durable: { aggregateID: session.id, seq: 1, version: 1 },
    data: { sessionID: session.id },
  })
  await resync.promise
  await setup.waitForVisualIdle({ quietFrames: 3 })
  expect(posted).toEqual([{ PROBE: "idle" }])

  setup.events.disconnect()
  await reconnected.promise
  expect(posted).toEqual([{ PROBE: "idle" }, { PROBE: "idle" }])
})
