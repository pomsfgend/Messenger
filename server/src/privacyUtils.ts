// This utility function centralizes the logic for filtering a user's profile data based on their privacy settings.
// It's used whenever one user's profile is sent to another user to ensure sensitive information is hidden if requested.

export const filterUserForPrivacy = (user: any, viewingUserId: string) => {
    // Return null if the user object is invalid.
    if (!user) return null;
    
    // Don't filter if:
    // 1. The user is viewing their own profile.
    // 2. The user object somehow lacks privacy settings (e.g., legacy data), in which case we default to showing the data.
    if (user.id === viewingUserId || user.privacy_show_phone === undefined) {
        return user;
    }

    const filtered = { ...user };
    
    // SQLite stores booleans as 0 (false) or 1 (true).
    // If the setting is 0, we nullify the corresponding field.
    if (user.privacy_show_phone === 0) filtered.phoneNumber = null;
    if (user.privacy_show_telegram === 0) filtered.telegramId = null;
    if (user.privacy_show_dob === 0) filtered.dob = null;
    if (user.privacy_show_description === 0) filtered.description = null;
    
    // For 'last seen', if privacy is enabled, we show a generic "recent" status instead of the exact timestamp.
    if (user.privacy_show_last_seen === 0 && user.lastSeen) {
        filtered.lastSeen = 'recent';
    }
    
    // The privacy flags themselves are internal and should never be sent to other users.
    delete filtered.privacy_show_phone;
    delete filtered.privacy_show_telegram;
    delete filtered.privacy_show_dob;
    delete filtered.privacy_show_description;
    delete filtered.privacy_show_last_seen;
    delete filtered.privacy_show_typing;

    return filtered;
};
