
import React, { useState, useEffect } from 'react';

interface CountdownTimerProps {
    expiryTimestamp: string;
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({ expiryTimestamp }) => {
    const calculateTimeLeft = () => {
        const difference = +new Date(expiryTimestamp) - +new Date();
        let timeLeft = {};

        if (difference > 0) {
            timeLeft = {
                days: Math.floor(difference / (1000 * 60 * 60 * 24)),
                hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
                minutes: Math.floor((difference / 1000 / 60) % 60),
                seconds: Math.floor((difference / 1000) % 60),
            };
        }

        return timeLeft;
    };

    const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

    useEffect(() => {
        const timer = setTimeout(() => {
            setTimeLeft(calculateTimeLeft());
        }, 1000);

        return () => clearTimeout(timer);
    });

    const timerComponents: string[] = [];

    Object.keys(timeLeft).forEach((interval) => {
        if (!timeLeft[interval as keyof typeof timeLeft] && interval !== 'seconds' && timerComponents.length === 0) {
            return;
        }
        // Always show at least minutes and seconds
        if (['days', 'hours'].includes(interval) && timeLeft[interval as keyof typeof timeLeft] === 0 && timerComponents.length === 0) return;
        
        timerComponents.push(
            String(timeLeft[interval as keyof typeof timeLeft]).padStart(2, '0')
        );
    });
    
    // Ensure we always show something, e.g., "00:00" when expired.
    if(timerComponents.length === 0) return <span>00:00</span>;
    if(timerComponents.length === 1) return <span>00:{timerComponents[0]}</span>;


    return <span>{timerComponents.join(':')}</span>;
};

export default CountdownTimer;