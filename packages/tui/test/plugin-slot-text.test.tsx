import { expect, test } from "bun:test"
import { createAppFixture } from "./fixture/app"
import { copyPlugin } from "./fixture/fixture"

test("plugin slots render bare text and reactive fragments without crashing the host", async () => {
  await using plugin = await copyPlugin("slot-text")
  await using setup = await createAppFixture({ config: { animations: false, plugins: [plugin.directory] } })
  await setup.ready
  await setup.waitForFrame((frame) => frame.includes("plain plugin text") && frame.includes("reactive plugin text 0"))
  expect(setup.captureCharFrame()).toContain("healthy plugin element")
  expect(setup.captureCharFrame()).toContain("42")

  setup.mockInput.pressKey("F9")
  await setup.waitForFrame((frame) => frame.includes("reactive plugin text 1"))
  expect(setup.captureCharFrame()).toContain("plain plugin text")
  expect(setup.captureCharFrame()).toContain("healthy plugin element")
})
