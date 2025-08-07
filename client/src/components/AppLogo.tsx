
import React from 'react';

const AppLogo: React.FC<{ className?: string, imgClassName?: string }> = ({ className, imgClassName = "h-24 w-24" }) => {
    const commonClasses = "rounded-full object-cover shadow-lg";
    const finalImgClasses = `${commonClasses} ${imgClassName}`;
    return (
        <div className={`relative ${className}`}>
            <img 
                src="/assets/logo_for_pc.jpg" 
                alt="Bulkhead Logo" 
                className={`hidden sm:block ${finalImgClasses}`}
            />
            <img 
                src="/assets/logo_for_mobile.jpg" 
                alt="Bulkhead Logo" 
                className={`block sm:hidden ${finalImgClasses}`}
            />
        </div>
    );
};

export default AppLogo;