export const AccountAllReceiveEnum = {
  DISABLED: 0,
  ENABLED: 1,
} as const;
export type AccountAllReceiveEnum = (typeof AccountAllReceiveEnum)[keyof typeof AccountAllReceiveEnum];