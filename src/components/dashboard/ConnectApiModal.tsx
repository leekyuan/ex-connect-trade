// Re-export the safer ApiSafetyModal under the legacy name for backwards-compat.
import { ApiSafetyModal } from "@/components/security/ApiSafetyModal";

interface Props { open: boolean; onOpenChange: (open: boolean) => void }
export function ConnectApiModal(props: Props) {
  return <ApiSafetyModal {...props} />;
}
