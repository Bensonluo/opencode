import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import path from "path"
import { ShellParse } from "@opencode/core/shell/parse"

// Directory arguments of cd-style commands are relative to the directory the shell is in when
// the command runs. A chain like `cd a && cd ../b` must resolve ../b against a, not against the
// invocation cwd, otherwise the external_directory prompt asks for a sibling of the project.
describe("ShellParse cd chains", () => {
  test.each(["bash", "zsh"])(`resolves chained relative cd against the running directory: %s`, async (shell) => {
    const command = "cd /tmp/oc-repro/project/layer-a && ls; echo done; cd ../layer-b && ls"
    const expected = {
      commands: [
        { resource: "ls", save: "ls *" },
        { resource: "echo done", save: "echo *" },
        { resource: "ls", save: "ls *" },
      ],
      directories: ["/tmp/oc-repro/project/layer-a", "/tmp/oc-repro/project/layer-b"],
    }
    expect(await Effect.runPromise(ShellParse.scan(command, shell, "/tmp/oc-repro/project"))).toEqual(expected)
    expect(
      await Effect.runPromise(ShellParse.scan(command, shell, "/tmp/oc-repro/project", { portable: true })),
    ).toEqual(expected)
  })

  test.each(["bash", "zsh"])(`emits absolute directories for relative single cd: %s`, async (shell) => {
    const expected = {
      commands: [{ resource: "git status", save: "git status *" }],
      directories: [path.resolve("/workspace", "../outside")],
    }
    expect(await Effect.runPromise(ShellParse.scan("cd ../outside && git status", shell, "/workspace"))).toEqual(
      expected,
    )
    expect(
      await Effect.runPromise(ShellParse.scan("cd ../outside && git status", shell, "/workspace", { portable: true })),
    ).toEqual(expected)
  })

  test.each(["bash", "zsh"])("restores the directory across pushd/popd: %s", async (shell) => {
    const command = "pushd a && cd b && popd && cd c"
    const expected = {
      commands: [],
      directories: [
        path.resolve("/workspace", "a"),
        path.resolve("/workspace", "a/b"),
        path.resolve("/workspace", "c"),
      ],
    }
    expect(await Effect.runPromise(ShellParse.scan(command, shell, "/workspace"))).toEqual(expected)
    expect(await Effect.runPromise(ShellParse.scan(command, shell, "/workspace", { portable: true }))).toEqual(
      expected,
    )
  })

  test("resolves chained relative Set-Location against the running directory", async () => {
    const command = "Set-Location src; Set-Location $PWD/../lib; Get-ChildItem"
    const expected = {
      commands: [{ resource: "Get-ChildItem", save: "Get-ChildItem *" }],
      directories: [path.resolve("/workspace", "src"), path.resolve("/workspace", "lib")],
    }
    expect(await Effect.runPromise(ShellParse.scan(command, "pwsh", "/workspace"))).toEqual(expected)
    expect(await Effect.runPromise(ShellParse.scan(command, "pwsh", "/workspace", { portable: true }))).toEqual(
      expected,
    )
  })

  test.each(["bash", "zsh"])("does not advance the directory for dynamic cd targets: %s", async (shell) => {
    const command = "cd $TARGET && cd ../sibling"
    const expected = {
      commands: [],
      directories: [path.resolve("/workspace", "../sibling")],
    }
    expect(await Effect.runPromise(ShellParse.scan(command, shell, "/workspace"))).toEqual(expected)
    expect(await Effect.runPromise(ShellParse.scan(command, shell, "/workspace", { portable: true }))).toEqual(
      expected,
    )
  })
})
