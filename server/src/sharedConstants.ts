// This constant defines all the fields needed to correctly construct a ChatContact object
// for the client-side. By sharing this constant, we ensure that both the main WebSocket
// handler and the Telegram bot handler fetch and send the same complete user profile data
// when creating a new chat, preventing inconsistencies.

export const CHAT_CONTACT_USER_FIELDS = `
    id, name, username, uniqueId, avatar_url as avatarUrl, last_seen as lastSeen,
    profile_color, message_color, createdAt
`;