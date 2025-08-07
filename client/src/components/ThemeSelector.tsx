import React from 'react';
import { useTheme, ThemeName } from '../hooks/useTheme';
import { useI18n } from '../hooks/useI18n';

const themes: { name: ThemeName; labelKey: string; colors: string[] }[] = [
    { name: 'theme-indigo', labelKey: 'indigo', colors: ['#4f46e5', '#a5b4fc'] },
    { name: 'theme-crimson', labelKey: 'crimson', colors: ['#dc2626', '#fca5a5'] },
    { name: 'theme-forest', labelKey: 'forest', colors: ['#16a34a', '#86efac'] },
    { name: 'theme-ocean', labelKey: 'ocean', colors: ['#0ea5e9', '#7dd3fc'] },
    { name: 'theme-amber', labelKey: 'amber', colors: ['#d97706', '#fcd34d'] },
    { name: 'theme-cyan', labelKey: 'cyan', colors: ['#0891b2', '#67e8f9'] },
    { name: 'theme-violet', labelKey: 'violet', colors: ['#7c3aed', '#c4b5fd'] },
];

const ThemeSelector: React.FC = () => {
    const { theme, setTheme } = useTheme();
    const { t } = useI18n();

    return (
        <div className="grid grid-cols-2 gap-3">
            {themes.map(item => (
                <button
                    key={item.name}
                    onClick={() => setTheme(item.name)}
                    className={`p-3 rounded-lg border-2 transition-all duration-200 flex flex-col gap-2 items-center text-center ${theme === item.name ? 'border-indigo-500 scale-105 shadow-lg bg-slate-200/50 dark:bg-slate-700/50' : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400'}`}
                >
                    <div className="flex -space-x-2">
                        {item.colors.map(color => (
                            <div key={color} className="w-5 h-5 rounded-full border-2 border-white dark:border-slate-800" style={{ backgroundColor: color }} />
                        ))}
                    </div>
                    <span className="font-semibold text-sm w-full truncate">{t(`theme.${item.labelKey}` as any)}</span>
                </button>
            ))}
        </div>
    );
};

export default ThemeSelector;