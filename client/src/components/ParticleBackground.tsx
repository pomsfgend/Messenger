
import React, { useEffect } from 'react';

const ParticleBackground: React.FC = () => {
    useEffect(() => {
        const particlesContainer = document.getElementById('particle-background');
        if (!particlesContainer) return;
        
        if (particlesContainer.childElementCount > 0) return;

        const particleCount = window.innerWidth < 768 ? 30 : 50;
        let createdParticles: HTMLElement[] = [];

        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle-item';
            
            const size = Math.random() * 6 + 2;
            const posX = Math.random() * 100;
            const posY = Math.random() * 100;
            const animationDuration = Math.random() * 20 + 10;
            const animationDelay = Math.random() * 5;
            const hue = Math.random() * 360;
            
            particle.style.width = `${size}px`;
            particle.style.height = `${size}px`;
            particle.style.left = `${posX}%`;
            particle.style.top = `${posY}%`;
            particle.style.animationDuration = `${animationDuration}s`;
            particle.style.animationDelay = `${animationDelay}s`;
            particle.style.backgroundColor = `hsla(${hue}, 100%, 70%, 0.3)`;
            
            particlesContainer.appendChild(particle);
            createdParticles.push(particle);
        }
        
        return () => {
            createdParticles.forEach(p => p.remove());
        };
    }, []);

    return (
        <div id="particle-background" className="fixed top-0 left-0 w-full h-full -z-10 pointer-events-none">
            <style>
                {`
                .particle-item {
                    position: absolute;
                    border-radius: 50%;
                    animation: float 15s infinite linear;
                }
                @keyframes float {
                    0% { transform: translateY(0) translateX(0); }
                    25% { transform: translateY(-20px) translateX(10px); }
                    50% { transform: translateY(0) translateX(20px); }
                    75% { transform: translateY(20px) translateX(10px); }
                    100% { transform: translateY(0) translateX(0); }
                }
                `}
            </style>
        </div>
    );
};

export default ParticleBackground;