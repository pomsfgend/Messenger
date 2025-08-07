import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useI18n } from '../hooks/useI18n';
import toast from 'react-hot-toast';

interface VideoRecorderModalProps {
    onClose: () => void;
    onSend: (file: File) => void;
}

const VideoRecorderModal: React.FC<VideoRecorderModalProps> = ({ onClose, onSend }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null); // For processing
    const animationFrameId = useRef<number | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const progressCircleRef = useRef<SVGCircleElement>(null);
    const { t } = useI18n();
    const [recordingTime, setRecordingTime] = useState(0);
    const recordingIntervalRef = useRef<number | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const MAX_RECORDING_TIME_S = 60;
    
    const isCancelledRef = useRef(false);
    const recordingTimeRef = useRef(0);

    const drawFrame = useCallback(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState < 2) {
            animationFrameId.current = requestAnimationFrame(drawFrame);
            return;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Black background
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Crop to square
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;
        const size = Math.min(videoWidth, videoHeight);
        const sx = (videoWidth - size) / 2;
        const sy = (videoHeight - size) / 2;

        // Draw video frame
        ctx.drawImage(video, sx, sy, size, size, 0, 0, canvas.width, canvas.height);

        animationFrameId.current = requestAnimationFrame(drawFrame);
    }, []);

    const cleanup = useCallback(() => {
        if (animationFrameId.current) {
            cancelAnimationFrame(animationFrameId.current);
            animationFrameId.current = null;
        }
        if (recordingIntervalRef.current) {
            clearInterval(recordingIntervalRef.current);
            recordingIntervalRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => {
                track.stop();
            });
            streamRef.current = null;
        }
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            try {
                mediaRecorderRef.current.stop();
            } catch (e) {
                // Ignore if already stopped
            }
        }
    }, []);

    const handleStopRecording = useCallback((shouldSend: boolean) => {
        isCancelledRef.current = !shouldSend;
        cleanup();
    }, [cleanup]);
    
    useEffect(() => {
        let isMounted = true;
        isCancelledRef.current = false;

        const startRecording = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                if (!isMounted) {
                    stream.getTracks().forEach(track => track.stop());
                    return;
                }
                streamRef.current = stream;

                if (videoRef.current) {
                    videoRef.current.srcObject = streamRef.current;
                    await videoRef.current.play(); // Start playing the source video to draw it on canvas
                }
                
                // Setup canvas
                const canvas = document.createElement('canvas');
                canvas.width = 480;
                canvas.height = 480;
                canvasRef.current = canvas;

                // Start drawing loop
                animationFrameId.current = requestAnimationFrame(drawFrame);
                
                const canvasStream = canvas.captureStream(30); // 30 FPS
                const audioTracks = stream.getAudioTracks();
                if (audioTracks.length > 0) {
                    canvasStream.addTrack(audioTracks[0]);
                }
                
                const options = { mimeType: 'video/webm;codecs=vp9,opus' };
                if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                     toast.error(t('toast.unsupportedFileType'));
                     onClose();
                     return;
                }

                mediaRecorderRef.current = new MediaRecorder(canvasStream, options);
                const chunks: BlobPart[] = [];
                
                mediaRecorderRef.current.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        chunks.push(event.data);
                    }
                };
                
                mediaRecorderRef.current.onstop = () => {
                    streamRef.current?.getTracks().forEach(track => track.stop());

                    if (isCancelledRef.current || recordingTimeRef.current < 1) {
                        if (recordingTimeRef.current < 1 && !isCancelledRef.current) {
                            toast.error(t('videoRecorder.tooShort'));
                        }
                        onClose();
                        return;
                    }

                    const blob = new Blob(chunks, { type: options.mimeType });
                    
                    if (blob.size > 512) { 
                        const file = new File([blob], `vid-circle-${Date.now()}.webm`, { type: options.mimeType });
                        onSend(file);
                    } else if (chunks.length > 0) {
                        toast.error(t('toast.emptyFileError'));
                    }
                    onClose();
                };
                
                mediaRecorderRef.current.start(250);
                
                setRecordingTime(0);
                recordingTimeRef.current = 0;
                recordingIntervalRef.current = window.setInterval(() => {
                    setRecordingTime(prev => {
                        const newTime = prev + 1;
                        recordingTimeRef.current = newTime;
                        if (newTime >= MAX_RECORDING_TIME_S) {
                            handleStopRecording(true);
                        }
                        if (progressCircleRef.current) {
                            const radius = progressCircleRef.current.r.baseVal.value;
                            const circumference = 2 * Math.PI * radius;
                            const offset = circumference - (newTime / MAX_RECORDING_TIME_S) * circumference;
                            progressCircleRef.current.style.strokeDashoffset = `${offset}`;
                        }
                        return newTime;
                    });
                }, 1000);

            } catch (err) { 
                toast.error(t('toast.camDenied'));
                onClose(); 
            }
        };

        startRecording();

        return () => {
            isMounted = false;
            cleanup();
        }
    }, [onClose, onSend, t, cleanup, handleStopRecording, drawFrame]);


    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[150] flex items-center justify-center p-4">
            <div className="relative w-72 h-72">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover rounded-full" />
                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="50" cy="50" r="48" stroke="currentColor" strokeWidth="4" fill="none" className="text-white/30" />
                    <circle ref={progressCircleRef} cx="50" cy="50" r="48" stroke="currentColor" strokeWidth="4" fill="none" className="text-red-500" style={{ strokeDasharray: 2 * Math.PI * 48, strokeDashoffset: 2 * Math.PI * 48, transition: 'stroke-dashoffset 1s linear' }} />
                </svg>
                 <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white px-2 py-0.5 rounded-full text-sm font-mono">{recordingTime}s</div>
                 <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 flex items-center gap-10">
                    <button onClick={() => handleStopRecording(false)} className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-lg flex items-center justify-center text-white hover:bg-white/30 transition-colors" title={t('common.cancel')}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                    <button onClick={() => handleStopRecording(true)} className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center text-white hover:bg-green-600 transition-colors" title={t('chat.send')}>
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VideoRecorderModal;