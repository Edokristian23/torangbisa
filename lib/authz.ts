import { UserRole } from "@prisma/client";

export const ADMIN_ROLES: UserRole[] = ["SUPER_ADMIN", "BPKP_ADMIN"];
export const REVIEW_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "BPKP_ADMIN",
  "BPKP_REVIEWER",
  "AUDITOR",
];
export const BLUD_ROLES: UserRole[] = [
  "BLUD_ADMIN",
  "BLUD_OPERATOR",
  "BLU_ADMIN",
  "BLU_OPERATOR",
];

export function isAdminRole(role?: UserRole | null) {
  return !!role && ADMIN_ROLES.includes(role);
}

export function canReview(role?: UserRole | null) {
  return !!role && REVIEW_ROLES.includes(role);
}

export function canManageUsers(role?: UserRole | null) {
  return !!role && ADMIN_ROLES.includes(role);
}

export function canEditAssessment(role?: UserRole | null) {
  return !!role && BLUD_ROLES.includes(role);
}
