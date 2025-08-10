import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import * as api from '../services/api';
import type { User } from '../types';
import toast from 'react-hot-toast';
import UserManagementModal from '../components/UserManagementModal';
import { useI18n } from '../hooks/useI18n';
import Avatar from '../components/Avatar';
import './AdminPage.css';
import { useDraggable } from '../hooks/useDraggable';
import { useResizable } from '../hooks/useResizable';
import { FaUsers, FaWifi, FaGavel } from 'react-icons/fa';

const StatCard: React.FC<{ title: string, value: string | number, icon: React.ReactNode }> = ({ title, value, icon }) => (
    <div className="stat-card glass">
        <div className="stat-icon">
            {icon}
        </div>
        <div className="stat-info">
            <p className="stat-value">{value}</p>
            <p className="stat-title">{title}</p>
        </div>
    </div>
);

const AdminPage: React.FC = () => {
    const { t } = useI18n();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = ReactRouterDOM.useNavigate();

    const containerRef = useRef<HTMLDivElement>(null);
    const handleRef = useRef<HTMLDivElement>(null);
    const modalId = 'admin-panel';
    const { transform } = useDraggable(containerRef, handleRef, modalId);
    const { size } = useResizable(containerRef, modalId);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const userList = await api.adminGetAllUsers();
            setUsers(userList);
        } catch (error) {
            toast.error(t('toast.adminUserFetchError'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, [t]);

    const filteredUsers = useMemo(() => {
        if (!searchTerm) return users;
        return users.filter(user =>
            user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.uniqueId?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [users, searchTerm]);

    const stats = useMemo(() => {
        return {
            total: users.length,
            online: users.filter(u => u.lastSeen === null).length,
            banned: users.filter(u => u.is_banned).length,
        }
    }, [users]);

    const handleManageClick = (user: User) => {
        setSelectedUser(user);
        setIsModalOpen(true);
    };

    const handleModalClose = () => {
        setIsModalOpen(false);
        setSelectedUser(null);
    };

    const handleUpdateSuccess = () => {
        handleModalClose();
        fetchUsers(); // Refresh the list
    };
    
    const renderContent = () => (
        <div className="admin-page-container">
            {isModalOpen && selectedUser && (
                <UserManagementModal user={selectedUser} onClose={handleModalClose} onUpdate={handleUpdateSuccess} />
            )}
            <div ref={handleRef} className="admin-page-header cursor-move">
                <h1 className="admin-title">{t('admin.title')}</h1>
                <button onClick={() => navigate('/app')} className="btn-primary py-2 px-4">
                    {t('profile.backToChat')}
                </button>
            </div>

            <div className="stats-grid-admin">
                <StatCard title="Всего пользователей" value={stats.total} icon={<FaUsers />} />
                <StatCard title="Сейчас онлайн" value={stats.online} icon={<FaWifi />} />
                <StatCard title="Забаненные" value={stats.banned} icon={<FaGavel />} />
            </div>

            <div className="admin-table-container glass">
                <div className="admin-table-controls">
                    <input
                        type="text"
                        placeholder={t('admin.searchPlaceholder')}
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="admin-search-input"
                    />
                </div>
                <div className="admin-table-wrapper">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>{t('admin.table.user')}</th>
                                <th>{t('admin.table.role')}</th>
                                <th>{t('admin.table.status')}</th>
                                <th>{t('admin.table.joined')}</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map((user) => (
                                <tr key={user.id}>
                                    <td>
                                        <div className="user-cell">
                                            <Avatar user={user} size="default" />
                                            <div className="user-info">
                                                <div className="user-name">{user.name}</div>
                                                <div className="user-id">@{user.uniqueId}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`role-pill role-${user.role}`}>{user.role}</span>
                                    </td>
                                    <td>
                                        <div className="status-cell">
                                            {user.is_banned ? (
                                                <span className="status-pill status-banned" title={user.ban_reason || t('admin.status.banned')}>{t('admin.status.banned')}</span>
                                            ) : (
                                                <span className="status-pill status-active">{t('admin.status.active')}</span>
                                            )}
                                            {(user.mute_expires_at && new Date(user.mute_expires_at) > new Date()) && (
                                                <span className="status-pill status-muted" title={user.mute_reason || t('admin.status.muted')}>{t('admin.status.muted')}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                                    <td>
                                        <button onClick={() => handleManageClick(user)} className="manage-button">
                                            {t('admin.manage')}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-100 dark:bg-slate-900">
                <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-slate-500"></div>
            </div>
        );
    }
    
    return (
        <div className="fixed inset-0 z-[100] pointer-events-none">
             <div
                ref={containerRef}
                className="mx-auto rounded-lg shadow-2xl overflow-hidden pointer-events-auto absolute"
                style={{
                    transform: `translate(${transform.x}px, ${transform.y}px)`,
                    width: size.width ? `${size.width}px` : 'min(95vw, 1200px)',
                    height: size.height ? `${size.height}px` : '90vh',
                    top: '5vh',
                    left: '2.5vw',
                    minWidth: '600px',
                    minHeight: '500px',
                }}
             >
                <div className="h-full w-full overflow-y-auto">
                    {renderContent()}
                </div>
             </div>
        </div>
    );
};

export default AdminPage;