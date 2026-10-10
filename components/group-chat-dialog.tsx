"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"

import { createGroupChat } from "@/actions/chat"
import { ChatAvatar } from "@/components/chat-avatar"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import {
  groupChatInsertSchema,
  type bots,
  type GroupChatInsert,
} from "@/db/schema"

type SelectableBot = Pick<typeof bots.$inferSelect, "id" | "name" | "avatar">

function GroupChatForm({
  bots,
  onCreated,
}: {
  bots: SelectableBot[]
  onCreated: () => void
}) {
  const router = useRouter()
  const form = useForm<GroupChatInsert>({
    resolver: zodResolver(groupChatInsertSchema),
    defaultValues: { name: "", botIds: [] },
  })
  const { isSubmitting } = form.formState

  async function onSubmit(values: GroupChatInsert) {
    try {
      const chat = await createGroupChat(values)
      toast.add({
        type: "success",
        title: "Group chat created",
        description: `${chat.name} is ready.`,
      })
      onCreated()
      router.push(`/chats/${chat.id}`)
    } catch {
      toast.add({
        type: "error",
        title: "Could not create the group chat",
        description: "Something went wrong. Please try again.",
      })
    }
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-col gap-4"
    >
      <FieldGroup>
        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="group-chat-name">Name</FieldLabel>
              <Input
                {...field}
                id="group-chat-name"
                placeholder="Weekend plans"
                autoComplete="off"
                aria-invalid={fieldState.invalid}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          name="botIds"
          control={form.control}
          render={({ field, fieldState }) => (
            <FieldSet data-invalid={fieldState.invalid}>
              <FieldLegend variant="label">Bots</FieldLegend>
              {bots.length === 0 && (
                <FieldDescription>
                  You have no bots yet. Create a couple first.
                </FieldDescription>
              )}
              <FieldGroup
                data-slot="checkbox-group"
                className="max-h-56 overflow-y-auto"
              >
                {bots.map((bot) => (
                  <Field key={bot.id} orientation="horizontal">
                    <Checkbox
                      id={`group-chat-bot-${bot.id}`}
                      name={field.name}
                      aria-invalid={fieldState.invalid}
                      checked={field.value.includes(bot.id)}
                      onCheckedChange={(checked) =>
                        field.onChange(
                          checked
                            ? [...field.value, bot.id]
                            : field.value.filter((id) => id !== bot.id)
                        )
                      }
                    />
                    <FieldLabel
                      htmlFor={`group-chat-bot-${bot.id}`}
                      className="items-center font-normal"
                    >
                      <ChatAvatar seed={bot.avatar} className="size-5" />
                      <span className="truncate">{bot.name}</span>
                    </FieldLabel>
                  </Field>
                ))}
              </FieldGroup>
              <FieldError errors={[fieldState.error]} />
            </FieldSet>
          )}
        />
      </FieldGroup>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>
          Cancel
        </DialogClose>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Spinner data-icon="inline-start" />}
          Create group
        </Button>
      </DialogFooter>
    </form>
  )
}

// Opened from elsewhere, such as a menu item, so it has no trigger of its
// own and the caller holds the open state.
function GroupChatDialog({
  bots,
  open,
  onOpenChange,
}: {
  bots: SelectableBot[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New group chat</DialogTitle>
          <DialogDescription>
            Name the group and pick which bots are in it.
          </DialogDescription>
        </DialogHeader>
        <GroupChatForm bots={bots} onCreated={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

export { GroupChatDialog }
