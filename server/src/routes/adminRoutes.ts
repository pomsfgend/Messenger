
import express, { Router, NextFunction } from 'express';
import { getDb } from '../db';
import { isModeratorOrAdmin } from '../auth';
import fs from 'fs/promises';
import path from 'path';
import { __dirname } from '../utils';
import { sanitizeMediaUrl } from '../fileUtils';

const router = Router();

const roleHierarchy: Record<string, number> = {
    'user': 0,
    'moderator': 1,
    'admin': 2
};

const superAdminUniqueIds = process.env.ADMIN_IDS?.split(',').map(id => id.trim()).filter(Boolean) || [];


// GET /api/admin/users
router.get('/users', isModeratorOrAdmin, async (req: express.Request, res: express.Response) => {
    const db = getDb();
    try {
        const users = await db.all('SELECT id, username, name, uniqueId, role, is_banned, ban_reason, ban_expires_at, createdAt, mute_expires_at, mute_reason, avatar_url as avatarUrl FROM users ORDER BY createdAt DESC');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch users.' });
    }
});

// Middleware to check if a user can perform an action on another user.
const checkPermissions = async (req: express.Request, res: express.Response, next: NextFunction) => {
    const { userId: targetUserId } = req.params;
    const requester = req.user!;
    
    const db = getDb();
    
    if (targetUserId === requester.id) {
        return res.status(403).json({ message: 'You cannot perform this action on yourself.' });
    }

    try {
        const requesterData = await db.get('SELECT uniqueId, role FROM users WHERE id = ?', requester.id);
        const targetUser = await db.get('SELECT uniqueId, role FROM users WHERE id = ?', targetUserId);
        
        if (!requesterData) return res.status(401).json({ message: 'Requester not found.' });
        if (!targetUser) return res.status(404).json({ message: 'Target user not found.' });

        // A super admin can manage anyone who is NOT also a super admin.
        const requesterIsSuperAdmin = superAdminUniqueIds.includes(requesterData.uniqueId);
        const targetIsSuperAdmin = superAdminUniqueIds.includes(targetUser.uniqueId);

        if (requesterIsSuperAdmin && !targetIsSuperAdmin) {
             return next();
        }

        const requesterLevel = roleHierarchy[requester.role];
        const targetLevel = roleHierarchy[targetUser.role as keyof typeof roleHierarchy];

        // A user can only manage users with a strictly lower role level.
        if (requesterLevel > targetLevel) {
            return next();
        }
        
        return res.status(403).json({ message: 'You do not have permission to manage this user.' });

    } catch (error) {
        console.error("Permission check failed:", error);
        res.status(500).json({ message: 'Failed to verify permissions.' });
    }
};


// PUT /api/admin/users/:userId/role
router.put('/users/:userId/role', isModeratorOrAdmin, checkPermissions, async (req: express.Request, res: express.Response) => {
    const { userId } = req.params;
    const { role } = req.body;

    if (!['user', 'moderator', 'admin'].includes(role)) {
        return res.status(400).json({ message: 'Invalid role specified.' });
    }
    
    // Only super admins can promote others to admin.
    const requesterData = await getDb().get('SELECT uniqueId FROM users WHERE id = ?', req.user!.id);
    if (role === 'admin' && !superAdminUniqueIds.includes(requesterData.uniqueId)) {
         return res.status(403).json({ message: 'Only super admins can assign admin roles.' });
    }

    const db = getDb();
    try {
        await db.run('UPDATE users SET role = ? WHERE id = ?', [role, userId]);
        res.status(200).json({ message: 'User role updated successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update user role.' });
    }
});

// PUT /api/admin/users/:userId/ban
router.put('/users/:userId/ban', isModeratorOrAdmin, checkPermissions, async (req: express.Request, res: express.Response) => {
    const { userId } = req.params;
    const { is_banned, ban_reason, ban_duration_hours } = req.body;

    if (typeof is_banned !== 'boolean') {
        return res.status(400).json({ message: 'is_banned must be a boolean.' });
    }
    const db = getDb();
    try {
        let banExpiresAt: string | null = null;
        const finalBanReason: string | null = is_banned ? (ban_reason || null) : null;
        
        if (is_banned) {
            if (ban_duration_hours) {
                const expiryDate = new Date();
                expiryDate.setHours(expiryDate.getHours() + Number(ban_duration_hours));
                banExpiresAt = expiryDate.toISOString();
            } else { // Permanent Ban
                 banExpiresAt = new Date('9999-12-31T23:59:59Z').toISOString();
            }
        }
        
        await db.run(
            'UPDATE users SET is_banned = ?, ban_reason = ?, ban_expires_at = ? WHERE id = ?',
            [is_banned ? 1 : 0, finalBanReason, banExpiresAt, userId]
        );
        res.status(200).json({ message: 'User ban status updated successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update user ban status.' });
    }
});

router.put('/users/:userId/mute', isModeratorOrAdmin, checkPermissions, async (req: express.Request, res: express.Response) => {
    const { userId } = req.params;
    const { is_muted, mute_reason, mute_duration_hours } = req.body;
    
    if (typeof is_muted !== 'boolean') {
        return res.status(400).json({ message: 'is_muted must be a boolean.' });
    }
    const db = getDb();
    try {
        let muteExpiresAt: string | null = null;
        const finalMuteReason: string | null = is_muted ? (mute_reason || null) : null;

        if (is_muted) {
            if (mute_duration_hours) {
                const expiryDate = new Date();
                expiryDate.setHours(expiryDate.getHours() + Number(mute_duration_hours));
                muteExpiresAt = expiryDate.toISOString();
            } else {
                // This corresponds to the "Permanent" option
                muteExpiresAt = new Date('9999-12-31T23:59:59Z').toISOString();
            }
        }

        await db.run(
            'UPDATE users SET mute_expires_at = ?, mute_reason = ? WHERE id = ?',
            [muteExpiresAt, finalMuteReason, userId]
        );
        res.status(200).json({ message: 'User mute status updated successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update user mute status.' });
    }
});

router.delete('/users/:userId', isModeratorOrAdmin, checkPermissions, async (req: express.Request, res: express.Response) => {
    const { userId } = req.params;
    const db = getDb();

    try {
        await db.run('BEGIN TRANSACTION');
        
        // Step 1: Gather file paths to delete later
        const allAvatars = await db.all('SELECT filename FROM user_avatars WHERE userId = ?', userId);
        const mediaMessages = await db.all('SELECT media_url FROM messages WHERE senderId = ? AND media_url IS NOT NULL', userId);
        
        // Step 2: Explicitly delete dependent records first for robustness (supplements ON DELETE CASCADE)
        await db.run('DELETE FROM messages WHERE senderId = ?', userId);
        await db.run('DELETE FROM user_avatars WHERE userId = ?', userId);

        // Step 3: Delete the main user record
        const result = await db.run('DELETE FROM users WHERE id = ?', userId);

        if (result.changes === 0) {
            await db.run('ROLLBACK');
            return res.status(404).json({ message: "User to delete not found."});
        }
        
        await db.run('COMMIT');

        // Step 4: Asynchronously delete files from storage after DB transaction is successful
        (async () => {
            const uploadsDir = path.join(__dirname, '..', 'uploads');
            const filesToDelete = [
                ...allAvatars.map(ava => ava.filename),
                ...mediaMessages.map(msg => msg.media_url)
            ].filter(Boolean);
            
            for (const rawFilename of filesToDelete) {
                 const sanitizedFilename = sanitizeMediaUrl(rawFilename);
                 if (!sanitizedFilename) continue;
                 const filePath = path.join(uploadsDir, sanitizedFilename);
                 await fs.unlink(filePath).catch(err => {
                    if (err.code !== 'ENOENT') {
                         console.error(`Could not delete file ${filePath} for deleted user ${userId}.`, err);
                    }
                })
            }
        })();
        
        res.status(200).json({ message: 'User and all associated data deleted successfully.' });

    } catch(error) {
        await db.run('ROLLBACK').catch(console.error);
        console.error(`Error deleting user ${userId}:`, error);
        res.status(500).json({ message: 'Failed to delete user.' });
    }
});

export default router;