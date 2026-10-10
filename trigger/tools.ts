import type { Sandbox } from "@daytona/sdk"
import type { InferChatUIMessageFromTools } from "@trigger.dev/sdk/ai"
import { tool } from "ai"
import { z } from "zod"

import { daytona } from "@/lib/daytona"

// keeps one runaway command or file from flooding the model's context
const MAX_OUTPUT_CHARS = 20_000
const COMMAND_TIMEOUT_SECONDS = 120

function truncate(text: string) {
  return text.length > MAX_OUTPUT_CHARS
    ? `${text.slice(0, MAX_OUTPUT_CHARS)}\n… truncated ${text.length - MAX_OUTPUT_CHARS} more characters`
    : text
}

const point = {
  x: z.number().int().describe("Pixels from the left edge of the screen."),
  y: z.number().int().describe("Pixels from the top edge of the screen."),
}

const modifiers = z
  .array(z.enum(["ctrl", "alt", "shift", "cmd"]))
  .optional()
  .describe("Modifier keys held during the action.")

// The tools for one turn, all acting on the sandbox of the chat's bot.
// `getSandboxId` is only called once a tool actually runs.
export function createTools(getSandboxId: () => Promise<string | null>) {
  let sandbox: Promise<Sandbox> | undefined
  let desktop: Promise<Sandbox> | undefined

  // The sandbox stops itself when idle, so wake it before the first use.
  function getSandbox() {
    sandbox ??= (async () => {
      const sandboxId = await getSandboxId()

      if (!sandboxId) {
        throw new Error("This bot has no sandbox.")
      }

      const found = await daytona.get(sandboxId)

      if (found.state !== "started") {
        await found.start()
      }

      return found
    })()

    return sandbox
  }

  // Mouse, keyboard and screen need the desktop processes; starting them
  // again when they are already up is a no-op.
  function getDesktop() {
    desktop ??= (async () => {
      const found = await getSandbox()
      await found.computerUse.start()

      return found
    })()

    return desktop
  }

  async function takeScreenshot() {
    const { computerUse } = await getDesktop()
    // full scale, so the pixels the model sees are the ones it clicks
    const shot = await computerUse.screenshot.takeCompressed({
      format: "jpeg",
      quality: 70,
      showCursor: true,
    })

    if (!shot.screenshot) {
      throw new Error("The sandbox returned an empty screenshot.")
    }

    return { mediaType: "image/jpeg", base64: shot.screenshot }
  }

  type Screenshot = Awaited<ReturnType<typeof takeScreenshot>>

  // the model gets the image itself rather than a base64 string
  function screenshotToModelOutput({ output }: { output: Screenshot }) {
    return {
      type: "content" as const,
      value: [
        {
          type: "file" as const,
          mediaType: output.mediaType,
          data: { type: "data" as const, data: output.base64 },
        },
      ],
    }
  }

  return {
    bash: tool({
      description:
        "Run a bash command in your sandbox and get its combined stdout and stderr with the exit code. Commands are non-interactive and time out after two minutes; run long-lived processes in the background.",
      inputSchema: z.object({
        command: z.string().describe("The command to run."),
        cwd: z
          .string()
          .optional()
          .describe("Working directory. Defaults to your home directory."),
      }),
      execute: async ({ command, cwd }) => {
        const { process } = await getSandbox()
        const response = await process.executeCommand(
          command,
          cwd,
          undefined,
          COMMAND_TIMEOUT_SECONDS
        )

        return {
          exitCode: response.exitCode,
          output: truncate(response.result),
        }
      },
    }),
    readFile: tool({
      description: "Read a text file from your sandbox.",
      inputSchema: z.object({
        path: z
          .string()
          .describe("File path, absolute or relative to your home directory."),
      }),
      execute: async ({ path }) => {
        const { fs } = await getSandbox()
        const file = await fs.downloadFile(path)

        return { content: truncate(file.toString("utf8")) }
      },
    }),
    writeFile: tool({
      description:
        "Write a text file in your sandbox, replacing it if it exists. Missing parent directories are created.",
      inputSchema: z.object({
        path: z
          .string()
          .describe("File path, absolute or relative to your home directory."),
        content: z.string().describe("The full content of the file."),
      }),
      execute: async ({ path, content }) => {
        const { fs } = await getSandbox()
        const file = Buffer.from(content, "utf8")
        await fs.uploadFile(file, path)

        return { path, bytes: file.byteLength }
      },
    }),
    listFiles: tool({
      description: "List the files and folders in a directory of your sandbox.",
      inputSchema: z.object({
        path: z
          .string()
          .default(".")
          .describe(
            "Directory path, absolute or relative to your home directory."
          ),
      }),
      execute: async ({ path }) => {
        const { fs } = await getSandbox()
        const files = await fs.listFiles(path)

        return {
          files: files.map((file) => ({
            name: file.name,
            isDirectory: file.isDir,
            size: file.size,
          })),
        }
      },
    }),
    mouseClick: tool({
      description:
        "Click on the sandbox screen. Look at the screen first so the coordinates are right.",
      inputSchema: z.object({
        ...point,
        button: z.enum(["left", "right", "middle"]).default("left"),
        double: z.boolean().default(false).describe("Double-click."),
        modifiers,
      }),
      execute: async ({ x, y, button, double, modifiers }) => {
        const { computerUse } = await getDesktop()

        return computerUse.mouse.click(
          x,
          y,
          button,
          double,
          undefined,
          modifiers
        )
      },
    }),
    mouseMove: tool({
      description:
        "Move the mouse pointer on the sandbox screen without clicking.",
      inputSchema: z.object(point),
      execute: async ({ x, y }) => {
        const { computerUse } = await getDesktop()

        return computerUse.mouse.move(x, y)
      },
    }),
    mouseDrag: tool({
      description:
        "Press the left mouse button at one point on the sandbox screen, drag to another and release.",
      inputSchema: z.object({
        startX: point.x,
        startY: point.y,
        endX: point.x,
        endY: point.y,
      }),
      execute: async ({ startX, startY, endX, endY }) => {
        const { computerUse } = await getDesktop()

        return computerUse.mouse.drag(startX, startY, endX, endY)
      },
    }),
    mouseScroll: tool({
      description: "Scroll the mouse wheel at a point on the sandbox screen.",
      inputSchema: z.object({
        ...point,
        direction: z.enum(["up", "down", "left", "right"]),
        amount: z
          .number()
          .int()
          .min(1)
          .max(20)
          .default(3)
          .describe("Wheel ticks; one tick moves a few lines."),
      }),
      execute: async ({ x, y, direction, amount }) => {
        const { computerUse } = await getDesktop()
        await computerUse.mouse.scroll(x, y, direction, amount)

        return { x, y, direction, amount }
      },
    }),
    keyboardType: tool({
      description:
        "Type text into whatever has keyboard focus on the sandbox screen. Newlines are sent as Enter.",
      inputSchema: z.object({
        text: z.string().describe("The text to type."),
      }),
      execute: async ({ text }) => {
        const { computerUse } = await getDesktop()
        await computerUse.keyboard.type(text)

        return { typed: text.length }
      },
    }),
    keyboardPress: tool({
      description:
        "Press a single key on the sandbox keyboard, optionally with modifiers, e.g. enter, escape, tab, backspace, up, f5, or c with ctrl.",
      inputSchema: z.object({
        key: z.string().describe("The key to press."),
        modifiers,
      }),
      execute: async ({ key, modifiers }) => {
        const { computerUse } = await getDesktop()
        await computerUse.keyboard.press(key, modifiers)

        return { key, modifiers: modifiers ?? [] }
      },
    }),
    viewScreen: tool({
      description:
        "Look at the sandbox screen yourself. Use it whenever you need to see the screen to do your work: before clicking, and after acting to check the result. The user does not see this screenshot.",
      inputSchema: z.object({}),
      execute: takeScreenshot,
      toModelOutput: screenshotToModelOutput,
    }),
    showScreen: tool({
      description:
        "Show the sandbox screen to the user as an image in the chat. Use it only when the user asks to see the screen or what is on it; for your own work use viewScreen.",
      inputSchema: z.object({}),
      execute: takeScreenshot,
      toModelOutput: screenshotToModelOutput,
    }),
  }
}

export type ChatTools = ReturnType<typeof createTools>
export type ChatUIMessage = InferChatUIMessageFromTools<ChatTools>
