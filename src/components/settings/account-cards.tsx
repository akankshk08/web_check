import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChangePasswordForm, DeleteAccountButton } from "./account-security";

/** Password + delete-account cards shared by agency Settings and the client portal Profile. */
export function AccountCards({ isOwner }: { isOwner: boolean }) {
  return (
    <>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Password</CardTitle>
            <CardDescription>Changing your password signs you out on all other devices.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
      <Card className="border-danger/30">
        <CardHeader>
          <div>
            <CardTitle>Delete account</CardTitle>
            <CardDescription>Permanently remove your account and personal data.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <DeleteAccountButton isOwner={isOwner} />
        </CardContent>
      </Card>
    </>
  );
}
