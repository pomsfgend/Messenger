
import React from 'react';

const presetColors = [
    '#ef4444', // red-500
    '#f97316', // orange-500
    '#eab308', // yellow-500
    '#22c55e', // green-500
    '#06b6d4', // cyan-500
    '#3b82f6', // blue-500
    '#a855f7', // purple-500
    '#ec4899', // pink-500
];

interface ColorPickerProps {
    selectedColor?: string | null;
    onColorSelect: (color: string | null) => void;
}

const ColorPicker: React.FC<ColorPickerProps> = ({ selectedColor, onColorSelect }) => {
    const customColor = selectedColor && !presetColors.includes(selectedColor) && selectedColor !== null ? selectedColor : '#ffffff';

    return (
        <div className="flex flex-wrap items-center gap-2">
            {/* Reset to default button */}
            <button
                onClick={() => onColorSelect(null)}
                title="Reset to default theme color"
                className={`w-8 h-8 rounded-full border-2 transition-transform transform hover:scale-110 flex items-center justify-center ${
                    selectedColor === null
                        ? 'border-indigo-500 scale-110'
                        : 'border-slate-300 dark:border-slate-600'
                }`}
            >
                <div className="w-full h-full rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">A</div>
            </button>
            
            {/* Preset color buttons */}
            {presetColors.map((color) => (
                <button
                    key={color}
                    onClick={() => onColorSelect(color)}
                    className={`w-8 h-8 rounded-full border-2 transition-transform transform hover:scale-110 ${
                        selectedColor === color
                            ? 'border-indigo-500 scale-110'
                            : 'border-transparent'
                    }`}
                >
                    <div className="w-full h-full rounded-full" style={{ backgroundColor: color }} />
                </button>
            ))}

            {/* Custom color picker */}
            <div className={`relative w-8 h-8 rounded-full border-2 transition-transform transform hover:scale-110 ${selectedColor && !presetColors.includes(selectedColor) && selectedColor !== null ? 'border-indigo-500 scale-110' : 'border-transparent'}`}>
                <input
                    type="color"
                    value={customColor}
                    onChange={(e) => onColorSelect(e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="w-full h-full rounded-full bg-gradient-to-br from-gray-400 via-white to-gray-500 flex items-center justify-center pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-800" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2H4zm11 14a1 1 0 11-2 0 1 1 0 012 0zM8.5 7.5a1 1 0 11-2 0 1 1 0 012 0zM12.5 7.5a1 1 0 11-2 0 1 1 0 012 0zM8.5 10.5a1 1 0 11-2 0 1 1 0 012 0zM11.5 13.5a1 1 0 11-2 0 1 1 0 012 0zM12.5 10.5a1 1 0 11-2 0 1 1 0 012 0zM6.5 4.5a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
                    </svg>
                </div>
            </div>
        </div>
    );
};

export default ColorPicker;