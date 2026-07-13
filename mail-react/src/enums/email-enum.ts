export const EmailUnreadEnum = {
  UNREAD: 0,
  READ: 1,
} as const;
export type EmailUnreadEnum = (typeof EmailUnreadEnum)[keyof typeof EmailUnreadEnum];

export const EmailStatusEnum = {
  DELIVERED: 0,
  COMPLAINED: 1,
  DELAYED: 2,
  BOUNCED: 3,
} as const;
export type EmailStatusEnum = (typeof EmailStatusEnum)[keyof typeof EmailStatusEnum];