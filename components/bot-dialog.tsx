"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { PlusIcon, ShuffleIcon, Trash2Icon } from "lucide-react"
import { nanoid } from "nanoid"
import { useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"

import { createBot, deleteBot, updateBot } from "@/actions/bot"
import { ChatAvatar } from "@/components/chat-avatar"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { usePaidFeatures } from "@/hooks/use-paid-features"
import { useUsageLimits } from "@/hooks/use-usage-limits"
import { botInsertSchema, type bots, type BotInsert } from "@/db/schema"

type EditableBot = Pick<
  typeof bots.$inferSelect,
  "id" | "name" | "avatar" | "job" | "instructions"
>

const presets = [
  {
    job: "Research assistant",
    instructions:
      "Answer briefly, cite sources, and say so when you are not sure.",
  },
  {
    job: "Code reviewer",
    instructions:
      "Point out bugs before style. Quote the line, explain the risk, and suggest a fix.",
  },
  {
    job: "Writing editor",
    instructions:
      "Tighten the prose without changing the voice. Explain every edit in a short note.",
  },
  {
    job: "Tutor",
    instructions:
      "Teach step by step, check understanding with a question, and never just hand over the answer.",
  },
]

function BotForm({ bot, onSaved }: { bot?: EditableBot; onSaved: () => void }) {
  const [seed] = useState(() => bot?.avatar ?? nanoid())
  const form = useForm<BotInsert>({
    resolver: zodResolver(botInsertSchema),
    defaultValues: {
      name: bot?.name ?? "",
      avatar: seed,
      job: bot?.job ?? "",
      instructions: bot?.instructions ?? "",
    },
  })
  const { isSubmitting } = form.formState

  async function onSubmit(values: BotInsert) {
    try {
      if (bot) {
        const saved = await updateBot(bot.id, values)
        toast.add({
          type: "success",
          title: "Bot updated",
          description: `Your changes to ${saved.name} are saved.`,
        })
      } else {
        const saved = await createBot(values)
        toast.add({
          type: "success",
          title: "Bot created",
          description: `${saved.name} is ready to chat.`,
        })
      }
      onSaved()
    } catch {
      toast.add({
        type: "error",
        title: bot ? "Could not update the bot" : "Could not create the bot",
        description: "Something went wrong. Please try again.",
      })
    }
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <Button
            key={preset.job}
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => {
              form.setValue("job", preset.job, { shouldValidate: true })
              form.setValue("instructions", preset.instructions, {
                shouldValidate: true,
              })
            }}
          >
            {preset.job}
          </Button>
        ))}
      </div>
      <FieldGroup>
        <Controller
          name="avatar"
          control={form.control}
          render={({ field }) => (
            <Field orientation="horizontal">
              <ChatAvatar
                seed={field.value ?? seed}
                animated
                className="size-10"
              />
              <FieldContent>
                <FieldTitle>Face</FieldTitle>
                <FieldDescription>
                  Shuffle until you find one you like.
                </FieldDescription>
              </FieldContent>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => field.onChange(nanoid())}
              >
                <ShuffleIcon data-icon="inline-start" />
                Shuffle
              </Button>
            </Field>
          )}
        />
        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="bot-name">Name</FieldLabel>
              <Input
                {...field}
                id="bot-name"
                placeholder="Ada"
                autoComplete="off"
                aria-invalid={fieldState.invalid}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          name="job"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="bot-job">Job</FieldLabel>
              <Input
                {...field}
                id="bot-job"
                placeholder="Research assistant"
                autoComplete="off"
                aria-invalid={fieldState.invalid}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          name="instructions"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="bot-instructions">
                How it should work
              </FieldLabel>
              <Textarea
                {...field}
                value={field.value ?? ""}
                id="bot-instructions"
                placeholder="Answer briefly, cite sources, and ask before running anything destructive."
                className="min-h-20"
                aria-invalid={fieldState.invalid}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
      </FieldGroup>
      <DialogFooter>
        {bot && <DeleteBotButton bot={bot} />}
        <DialogClose render={<Button type="button" variant="outline" />}>
          Cancel
        </DialogClose>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Spinner data-icon="inline-start" />}
          {bot ? "Save changes" : "Create bot"}
        </Button>
      </DialogFooter>
    </form>
  )
}

function DeleteBotButton({ bot }: { bot: EditableBot }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  async function onDelete() {
    setIsDeleting(true)

    try {
      await deleteBot(bot.id)
      toast.add({
        type: "success",
        title: "Bot deleted",
        description: `${bot.name} and its chat are gone.`,
      })
      // the chat this was opened from no longer exists
      router.push("/")
    } catch {
      toast.add({
        type: "error",
        title: "Could not delete the bot",
        description: "Something went wrong. Please try again.",
      })
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button type="button" variant="destructive" className="sm:mr-auto" />
        }
      >
        <Trash2Icon data-icon="inline-start" />
        Delete bot
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {bot.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the bot, its chat and its sandbox. It
            cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            type="button"
            variant="destructive"
            disabled={isDeleting}
            onClick={onDelete}
          >
            {isDeleting && <Spinner data-icon="inline-start" />}
            Delete bot
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// Creates a bot, or edits the one passed as `bot`.
//
// Pass `open` and `onOpenChange` to drive the dialog from elsewhere, such as
// a menu item; it then renders without its own trigger. Otherwise `trigger`
// replaces the default "Create a new bot" button.
function BotDialog({
  bot,
  trigger,
  open: openProp,
  onOpenChange,
}: {
  bot?: EditableBot
  trigger?: React.ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const requireFeatures = usePaidFeatures()
  const requireUsage = useUsageLimits()
  const controlled = openProp !== undefined
  const open = controlled ? openProp : internalOpen
  const setOpen = async (open: boolean) => {
    // Creating a bot is paid, and comes with a new, running sandbox. Editing
    // one is free.
    if (
      open &&
      !bot &&
      !(
        requireFeatures("bots", "sandboxes") &&
        (await requireUsage("bots", "sandbox"))
      )
    ) {
      return
    }

    if (!controlled) {
      setInternalOpen(open)
    }
    onOpenChange?.(open)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!controlled &&
        (trigger ? (
          <DialogTrigger render={trigger} />
        ) : (
          <DialogTrigger render={<Button variant="secondary" />}>
            <PlusIcon data-icon="inline-start" />
            Create a new bot
          </DialogTrigger>
        ))}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{bot ? "Edit bot" : "New bot"}</DialogTitle>
          <DialogDescription>
            {bot
              ? "Change its face, its name, or the job it does."
              : "Give it a face, a name, and a job to do."}
          </DialogDescription>
        </DialogHeader>
        <BotForm bot={bot} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

export { BotDialog }
