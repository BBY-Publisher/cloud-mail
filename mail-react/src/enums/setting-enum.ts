export const AutoRefreshEnum = {
  DISABLED: 0,
  ENABLED: 1,
} as const;
export type AutoRefreshEnum = (typeof AutoRefreshEnum)[keyof typeof AutoRefreshEnum];

export const SendTypeEnum = {
  BANNED: 0,
  INTERNAL_ONLY: 1,
  UNLIMITED: 2,
} as const;
export type SendTypeEnum = (typeof SendTypeEnum)[keyof typeof SendTypeEnum];

export const UserStatusEnum = {
  NORMAL: 0,
  BANNED: 1,
} as const;
export type UserStatusEnum = (typeof UserStatusEnum)[keyof typeof UserStatusEnum];