import type { Member } from "@lifebridge/contracts";

export const FIXTURE_HOUSEHOLD_ID = "hh_minh_an";
export const FIXTURE_CARE_RECIPIENT_ID = "person_an";
export const FIXTURE_CREATOR_ID = "member_lan";
export const FIXTURE_ASSIGNEE_ID = "member_minh";
export const FIXTURE_TIME_ZONE = "Asia/Bangkok";
export const FIXED_TEST_TIME = "2026-08-03T02:05:00.000Z";
export const FIXTURE_SECOND_HOUSEHOLD_ID = "hh_thu_binh";
export const FIXTURE_SECOND_CREATOR_ID = "member_thu";
export const FIXTURE_SECOND_MEMBER_ID = "member_binh";

export const FIXTURE_MEMBERS: readonly Member[] = [
  {
    memberId: FIXTURE_CREATOR_ID,
    householdId: FIXTURE_HOUSEHOLD_ID,
    displayNameKey: "members.lan",
    role: "caregiver",
    active: true,
  },
  {
    memberId: FIXTURE_ASSIGNEE_ID,
    householdId: FIXTURE_HOUSEHOLD_ID,
    displayNameKey: "members.minh",
    role: "member",
    active: true,
  },
  {
    memberId: FIXTURE_SECOND_CREATOR_ID,
    householdId: FIXTURE_SECOND_HOUSEHOLD_ID,
    displayNameKey: "members.thu",
    role: "caregiver",
    active: true,
  },
  {
    memberId: FIXTURE_SECOND_MEMBER_ID,
    householdId: FIXTURE_SECOND_HOUSEHOLD_ID,
    displayNameKey: "members.binh",
    role: "member",
    active: true,
  },
];

export function fixtureMember(memberId: string): Member | undefined {
  return FIXTURE_MEMBERS.find((member) => member.memberId === memberId);
}
