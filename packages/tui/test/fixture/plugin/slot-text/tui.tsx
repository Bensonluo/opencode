import { Plugin } from "@opencode/plugin/tui"
import { createSignal } from "solid-js"

export default Plugin.define({
  id: "fixture.slot-text",
  setup(context) {
    const [count, setCount] = createSignal(0)
    context.keymap.layer(() => ({
      commands: [
        {
          id: "fixture.slot-text",
          bind: "f9",
          run() {
            setCount((value) => value + 1)
          },
        },
      ],
    }))
    context.ui.slot({
      append: "home.footer",
      render: () => "plain plugin text",
    })
    context.ui.slot({
      append: "home.footer",
      render: () => (
        <>
          <text>healthy plugin element</text>
          {`reactive plugin text ${count()}`}
          {42}
        </>
      ),
    })
  },
})
