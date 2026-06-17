import { useState, type KeyboardEvent } from "react";
import { Button, Textarea } from "@heroui/react";
import { Send } from "lucide-react";

interface Props {
  disabled?: boolean;
  sending?: boolean;
  placeholder?: string;
  onSend: (body: string) => Promise<void> | void;
}

const MAX_LEN = 1600; // Twilio splits long SMS; cap at a sane multi-segment size.

export function Composer({ disabled, sending, placeholder, onSend }: Props) {
  const [value, setValue] = useState("");

  const trimmed = value.trim();
  const canSend = !disabled && !sending && trimmed.length > 0;

  async function submit() {
    if (!canSend) return;
    const body = trimmed;
    setValue("");
    try {
      await onSend(body);
    } catch {
      // On failure, restore the draft so the superadmin can retry.
      setValue(body);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    // Enter sends; Shift+Enter inserts a newline.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  }

  return (
    <div className="flex items-end gap-2 border-t border-default-200 bg-content1 px-3 py-2">
      <Textarea
        aria-label="Message body"
        value={value}
        onValueChange={(v) => setValue(v.slice(0, MAX_LEN))}
        onKeyDown={onKeyDown}
        minRows={1}
        maxRows={5}
        variant="flat"
        placeholder={placeholder || "Type a message…"}
        isDisabled={disabled}
        classNames={{ inputWrapper: "rounded-2xl" }}
      />
      <Button
        isIconOnly
        color="primary"
        radius="full"
        aria-label="Send message"
        isDisabled={!canSend}
        isLoading={sending}
        onPress={submit}
        className="mb-0.5"
      >
        {!sending && <Send className="h-4 w-4" />}
      </Button>
    </div>
  );
}

export default Composer;
