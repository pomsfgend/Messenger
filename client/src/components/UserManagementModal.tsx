import React, { useState, useMemo, useRef } from 'react';
import type { User } from '../types';
import * as api from '../services/api';
import toast from 'react-hot-toast';
import Avatar from './Avatar';
import { useI18n } from '../hooks/useI18n';
import { useAuth } from '../hooks/useAuth';
import { useDraggable } from '../hooks/useDraggable';
import { useResizable } from '../hooks/useResizable';

interface Props {
    user: User;
    onClose: () => void;
    onUpdate: () => void;
}

const getInitialDuration = (expiresAt: string | undefined | null): string => {
    if (!expiresAt || new Date(expiresAt) < new Date()) return '1';
    const expiryDate = new Date(expiresAt);
    if (expiryDate.getFullYear() > 9000) return 'permanent';

    const now = new Date();
    const diffHours = Math.round((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60));

    if (diffHours <= 1) return '1';
    if (diffHours <= 24) return '24';
    if (diffHours <= 168) return '168';
    
    return 'permanent';
}


const UserManagementModal: React.FC<Props> = ({ user, onClose, onUpdate }) => {
    const { currentUser } = useAuth();
    const { t } = useI18n();
    const [role, setRole] = useState(user.role);
    const [isBanned, setIsBanned] = useState(user.is_banned);
    const [banReason, setBanReason] = useState(user.ban_reason || '');
    const [banDuration, setBanDuration] = useState(getInitialDuration(user.ban_expires_at));
    
    const isMutedInitially = useMemo(() => !!user.mute_expires_at && new Date(user.mute_expires_at) > new Date(), [user.mute_expires_at]);
    const [isMuted, setIsMuted] = useState(isMutedInitially);
    const [muteReason, setMuteReason] = useState(user.mute_reason || '');
    const [muteDuration, setMuteDuration] = useState(getInitialDuration(user.mute_expires_at));
    
    const [loading, setLoading] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const modalRef = useRef<HTMLDivElement>(null);
    const handleRef = useRef<HTMLDivElement>(null);
    const modalId = `user-manage-${user.id}`;
    const { transform } = useDraggable(modalRef, handleRef, modalId);
    const { size } = useResizable(modalRef, modalId);
    
    const canManageUser = useMemo(() => {
        if (!currentUser) return false;
        if (currentUser.id === user.id) return false; // Cannot manage self
        const roleHierarchy = { 'user': 0, 'moderator': 1, 'admin': 2 };
        return (roleHierarchy[currentUser.role!] || 0) > (roleHierarchy[user.role!] || 0);
    }, [currentUser, user]);

    const canPromoteToAdmin = currentUser?.role === 'admin';

    const handleSaveChanges = async () => {
        if (!canManageUser) return toast.error("You don't have permission to manage this user.");
        setLoading(true);
        try {
            const promises = [];
            if (role !== user.role) {
                promises.push(api.adminUpdateUserRole(user.id, role!));
            }
            if (isBanned !== user.is_banned || (isBanned && banDuration !== getInitialDuration(user.ban_expires_at))) {
                 const durationHours = banDuration === 'permanent' ? undefined : Number(banDuration);
                 promises.push(api.adminUpdateUserBanStatus(user.id, isBanned!, banReason, durationHours));
            }
            if (isMuted !== isMutedInitially || (isMuted && muteDuration !== getInitialDuration(user.mute_expires_at))) {
                 const durationHours = muteDuration === 'permanent' ? undefined : Number(muteDuration);
                 promises.push(api.adminUpdateUserMuteStatus(user.id, isMuted, muteReason, durationHours));
            }
            
            await Promise.all(promises);
            toast.success("User updated successfully!");
            onUpdate();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to update user.");
        } finally {
            setLoading(false);
        }
    };
    
    const handleDeleteUser = async () => {
        if (!canManageUser) return toast.error("You don't have permission to manage this user.");
        if (window.confirm(t('userManagement.deleteConfirm', { username: user.name || user.username }))) {
            setDeleteLoading(true);
            try {
                await api.adminDeleteUser(user.id);
                toast.success("User deleted successfully.");
                onUpdate();
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Failed to delete user.");
            } finally {
                setDeleteLoading(false);
            }
        }
    };
    
    const inputClasses = "w-full bg-slate-200 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg p-2 text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none";
    const selectClasses = `${inputClasses} appearance-none`;

    return (
        <div className="fixed inset-0 bg-black/60 z-[120] flex items-center justify-center p-4 pointer-events-none" >
            <div 
                ref={modalRef}
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl flex flex-col p-6 space-y-6 animate-fade-in-up pointer-events-auto" 
                onClick={e => e.stopPropagation()}
                style={{
                    transform: `translate(${transform.x}px, ${transform.y}px)`,
                    width: size.width ? `${size.width}px` : 'min(90vw, 512px)',
                    height: size.height ? `${size.height}px` : 'auto',
                    minWidth: '320px',
                }}
            >
                <div ref={handleRef} className="flex items-start justify-between cursor-move">
                    <div className="flex items-center gap-4">
                        <Avatar user={user} size="default" />
                        <div>
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white">{user.name}</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">@{user.uniqueId}</p>
                        </div>
                    </div>
                     <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400">&times;</button>
                </div>
                
                {!canManageUser && <div className="text-center p-4 bg-yellow-100 dark:bg-yellow-500/20 text-yellow-800 dark:text-yellow-300 rounded-lg">{t('userManagement.permissionError')}</div>}

                {canManageUser && ( <>
                    <div className="space-y-4 overflow-y-auto pr-2">
                         {/* --- Role Management --- */}
                        <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('userManagement.role')}</label>
                            <select value={role} onChange={e => setRole(e.target.value as any)} className={selectClasses}>
                                <option value="user">{t('userManagement.roleUser')}</option>
                                <option value="moderator">{t('userManagement.roleModerator')}</option>
                                {canPromoteToAdmin && <option value="admin">{t('userManagement.roleAdmin')}</option>}
                            </select>
                        </div>

                        {/* --- Mute Management --- */}
                         <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-2">
                             <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-semibold text-slate-700 dark:text-slate-200">{t('userManagement.muteUser')}</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{t('userManagement.muteUserHelp')}</p>
                                </div>
                                <input type="checkbox" checked={isMuted} onChange={(e) => setIsMuted(e.target.checked)} className="h-6 w-6 rounded text-indigo-600 focus:ring-indigo-500" />
                             </div>
                             {isMuted && <div className="space-y-2 animate-fade-in">
                                <input type="text" value={muteReason} onChange={e => setMuteReason(e.target.value)} placeholder={t('userManagement.reasonForMute')} className={inputClasses}/>
                                <select value={muteDuration} onChange={e => setMuteDuration(e.target.value)} className={selectClasses}>
                                     <option value="1">{t('admin.1hour')}</option>
                                     <option value="24">{t('admin.1day')}</option>
                                     <option value="168">{t('admin.7days')}</option>
                                     <option value="permanent">{t('admin.permanent')}</option>
                                 </select>
                             </div>}
                         </div>
                        
                         {/* --- Ban Management --- */}
                         <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-2">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-semibold text-slate-700 dark:text-slate-200">{t('userManagement.banUser')}</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{t('userManagement.banUserHelp')}</p>
                                </div>
                                <input type="checkbox" checked={isBanned} onChange={(e) => setIsBanned(e.target.checked)} className="h-6 w-6 rounded text-indigo-600 focus:ring-indigo-500" />
                             </div>
                            {isBanned && <div className="space-y-2 animate-fade-in">
                                <input type="text" value={banReason} onChange={e => setBanReason(e.target.value)} placeholder={t('userManagement.reasonForBan')} className={inputClasses}/>
                                 <select value={banDuration} onChange={e => setBanDuration(e.target.value)} className={selectClasses}>
                                     <option value="1">{t('admin.1hour')}</option>
                                     <option value="24">{t('admin.1day')}</option>
                                     <option value="168">{t('admin.7days')}</option>
                                     <option value="permanent">{t('admin.permanent')}</option>
                                 </select>
                            </div>}
                        </div>

                         {/* --- Delete User --- */}
                         <div className="border-t border-red-500/30 pt-4 space-y-2">
                             <h3 className="font-semibold text-red-500 dark:text-red-400">{t('userManagement.deleteUser')}</h3>
                             <p className="text-xs text-slate-500 dark:text-slate-400">{t('userManagement.deleteUserHelp')}</p>
                             <div className="text-right">
                                <button onClick={handleDeleteUser} disabled={deleteLoading} className="bg-red-600 text-white font-bold py-2 px-4 rounded-lg text-sm hover:bg-red-700 disabled:bg-red-400/50">
                                    {deleteLoading ? t('common.deleting') : t('common.delete')}
                                </button>
                            </div>
                         </div>
                    </div>
                
                    <div className="flex justify-end gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                        <button onClick={onClose} className="bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors">{t('common.cancel')}</button>
                        <button onClick={handleSaveChanges} disabled={loading} className="bg-indigo-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-indigo-400/50">
                            {loading ? t('common.saving') : t('common.saveChanges')}
                        </button>
                    </div>
                </>)}
            </div>
        </div>
    )
};

export default UserManagementModal;
