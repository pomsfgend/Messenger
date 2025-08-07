
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import * as api from '../services/api';

const MagicLoginPage: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const { updateCurrentUser } = useAuth();
    const [status, setStatus] = useState('Logging you in...');

    useEffect(() => {
        const performLogin = async () => {
            if (!token) {
                setStatus('Invalid login link.');
                return;
            }
            try {
                const user = await api.magicLinkLogin(token);
                updateCurrentUser(user);
                // Navigate to global chat after a short delay to ensure state updates
                setTimeout(() => navigate('/app/chat/global', { replace: true }), 100);
            } catch (error: any) {
                setStatus(`Login failed: ${error.message}`);
                // Redirect to the standard login page after showing the error
                setTimeout(() => navigate('/app/login', { replace: true }), 3000);
            }
        };

        performLogin();
    }, [token, navigate, updateCurrentUser]);

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-200">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500 mb-4"></div>
            <p className="text-lg font-semibold">{status}</p>
        </div>
    );
};

export default MagicLoginPage;
