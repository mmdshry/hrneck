export function orgLiveChannel(tenant: string, topic: string) {
  return `org.${tenant}.${topic}`;
}

export function learnLiveChannel(tenant: string, userId: number) {
  return `org.${tenant}.learn.${userId}`;
}

export function portalLiveChannel(tenant: string, userId: number) {
  return `org.${tenant}.portal.${userId}`;
}

export function notificationsLiveChannel(tenant: string, userId: number) {
  return `org.${tenant}.notifications.${userId}`;
}
