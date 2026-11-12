export const sessionActivityKey = (userId: string) => `stockroom-last-activity:${userId}`

export function markSessionActive(userId: string) {
  try {
    localStorage.setItem(sessionActivityKey(userId), String(Date.now()))
  } catch (error) {
    console.error('Could not initialize the signed-in session activity.', error)
  }
}
