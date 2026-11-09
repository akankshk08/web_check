"use client";
import { removeClientUserAction, revokeInvitationAction } from "@/server/actions/clients";
import { ConfirmButton } from "./confirm-button";

export function RevokeInvitationButton({ id, email }: { id: string; email: string }) {
  return (
    <ConfirmButton
      size="sm"
      variant="ghost"
      action={() => revokeInvitationAction({ id })}
      title="Cancel invitation?"
      description={`The invitation link sent to ${email} will stop working.`}
      confirmLabel="Cancel invitation"
      success="Invitation cancelled."
    >
      Revoke
    </ConfirmButton>
  );
}

export function RemovePortalUserButton({ id, name }: { id: string; name: string }) {
  return (
    <ConfirmButton
      size="sm"
      variant="ghost"
      action={() => removeClientUserAction({ id })}
      title="Remove portal access?"
      description={`${name} will no longer be able to sign in to this client’s portal.`}
      confirmLabel="Remove"
      success="Access removed."
    >
      Remove
    </ConfirmButton>
  );
}
