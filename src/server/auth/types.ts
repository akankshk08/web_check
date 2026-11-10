import type { OrgRole } from "@/db/schema/enums";

export type Membership = { orgId: string; orgName: string; role: OrgRole };

/** Identity + permissions resolved on the server from the verified session. Never from client input. */
export type AuthContext = {
  userId: string;
  email: string;
  fullName: string;
  orgId: string;
  orgName: string;
  role: OrgRole;
  canManageFinances: boolean;
  /** Client accounts this user belongs to (CLIENT role only). */
  clientIds: string[];
  memberships: Membership[];
};
