import { useState } from "react";
import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Textarea,
} from "@heroui/react";

import { isLikelyPhone, normalizePhone } from "../utils";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sending?: boolean;
  /** Resolve with the new/affected conversationId so the parent can open it. */
  onSend: (to: string, body: string) => Promise<void>;
}

export function NewMessageModal({ isOpen, onClose, sending, onSend }: Props) {
  const [to, setTo] = useState("");
  const [body, setBody] = useState("");
  const [touched, setTouched] = useState(false);

  const phoneValid = isLikelyPhone(to);
  const canSend = phoneValid && body.trim().length > 0 && !sending;

  function reset() {
    setTo("");
    setBody("");
    setTouched(false);
  }

  async function submit() {
    if (!canSend) {
      setTouched(true);
      return;
    }
    await onSend(normalizePhone(to), body.trim());
    reset();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        reset();
        onClose();
      }}
      placement="center"
      size="md"
    >
      <ModalContent>
        {(close) => (
          <>
            <ModalHeader>New message</ModalHeader>
            <ModalBody className="gap-3">
              <Input
                autoFocus
                label="To (phone number)"
                labelPlacement="outside"
                placeholder="+14155552671"
                value={to}
                onValueChange={setTo}
                onBlur={() => setTouched(true)}
                isInvalid={touched && !phoneValid}
                errorMessage={
                  touched && !phoneValid ? "Enter a valid phone number." : undefined
                }
                description="E.164 format preferred. 10-digit US numbers get +1 automatically."
              />
              <Textarea
                label="Message"
                labelPlacement="outside"
                placeholder="Type your message…"
                minRows={3}
                maxRows={8}
                value={body}
                onValueChange={(v) => setBody(v.slice(0, 1600))}
              />
            </ModalBody>
            <ModalFooter>
              <Button variant="flat" onPress={close} isDisabled={sending}>
                Cancel
              </Button>
              <Button
                color="primary"
                onPress={submit}
                isLoading={sending}
                isDisabled={!canSend}
              >
                Send
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}

export default NewMessageModal;
