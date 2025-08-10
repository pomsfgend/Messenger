import toast from 'react-hot-toast';

/**
 * A robust video loader that waits for the 'canplaythrough' event and includes a timeout.
 */
const loadVideo = (videoElement: HTMLVideoElement, src: string): Promise<HTMLVideoElement> => {
    return new Promise((resolve, reject) => {
        let timeoutId: number;

        const onCanPlayThrough = () => {
            cleanup();
            resolve(videoElement);
        };
        const onError = (e: Event | string) => {
            cleanup();
            const error = new Error(`Failed to load video asset: ${src}`);
            (error as any).event = e;
            reject(error);
        };
        const onTimeout = () => {
            cleanup();
            reject(new Error(`Video readiness check timed out after 15 seconds.`));
        }

        const cleanup = () => {
            clearTimeout(timeoutId);
            videoElement.removeEventListener('canplaythrough', onCanPlayThrough);
            videoElement.removeEventListener('error', onError);
        };

        videoElement.addEventListener('canplaythrough', onCanPlayThrough, { once: true });
        videoElement.addEventListener('error', onError, { once: true });
        timeoutId = window.setTimeout(onTimeout, 15000); // 15-second timeout

        videoElement.src = src;
        videoElement.load();
    });
};

const triggerDirectDownload = (videoUrl: string) => {
    toast.success("Ваш браузер не поддерживает обработку видео. Начинается прямая загрузка.", { duration: 5000 });
    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = `bulik-original-${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
};


/**
 * Processes a video circle for download with all custom branding.
 */
export const processVideoCircleForDownload = async (
    videoUrl: string,
    onProgress?: (progress: number) => void
): Promise<void> => {
    let video: HTMLVideoElement | null = document.createElement('video');
    let logoBitmap: ImageBitmap | null = null;
    const canvas = document.createElement('canvas');
    let animationFrameId: number | null = null;
    let recorder: MediaRecorder | null = null;
    let videoObjectUrl: string | null = null;

    // Fallback for browsers that don't support captureStream (e.g., Safari)
    if (!canvas.captureStream) {
        triggerDirectDownload(videoUrl);
        return;
    }

    const cleanup = () => {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        if (video?.parentNode) document.body.removeChild(video);
        if (recorder && recorder.state === "recording") recorder.stop();
        if (videoObjectUrl) URL.revokeObjectURL(videoObjectUrl);
        video = null;
        logoBitmap = null;
    };

    try {
        if (onProgress) onProgress(1);

        const videoResponse = await fetch(videoUrl);
        if (!videoResponse.ok) throw new Error(`Failed to download video: ${videoResponse.statusText}`);
        const videoBlob = await videoResponse.blob();
        videoObjectUrl = URL.createObjectURL(videoBlob);
        video.muted = true;
        video.playsInline = true;
        video.preload = 'auto';
        video.style.display = 'none';
        document.body.appendChild(video);
        await loadVideo(video, videoObjectUrl);

        try {
            const logoResponse = await fetch('/assets/logo.png');
            if (logoResponse.ok) {
                const logoBlob = await logoResponse.blob();
                logoBitmap = await createImageBitmap(logoBlob);
            }
        } catch (e) {
            console.warn("Could not load logo for watermark, proceeding without it.", e);
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Could not get canvas context.");
        
        const FINAL_CANVAS_SIZE = 768;
        const VIDEO_CIRCLE_SIZE = 680;
        canvas.width = FINAL_CANVAS_SIZE;
        canvas.height = FINAL_CANVAS_SIZE;
        const duration = video.duration;

        const handleTimeUpdate = () => {
            if (onProgress && video) {
                onProgress(Math.min(100, Math.round((video.currentTime / duration) * 100)));
            }
        };

        video.addEventListener('timeupdate', handleTimeUpdate);
        
        const recordedChunks: BlobPart[] = [];
        const stream = canvas.captureStream();
        
        const supportedMimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp9', 'video/webm'].find(type => MediaRecorder.isTypeSupported(type));
        if (!supportedMimeType) throw new Error("No supported WebM MIME type found.");
        
        recorder = new MediaRecorder(stream, { mimeType: supportedMimeType, videoBitsPerSecond: 4000000 });
        recorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };
        recorder.onstop = () => {
            video?.removeEventListener('timeupdate', handleTimeUpdate);
            if (recordedChunks.length > 0) {
                const finalBlob = new Blob(recordedChunks, { type: 'video/webm' });
                const downloadUrl = URL.createObjectURL(finalBlob);
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = `bulik-${Date.now()}.webm`;
                document.body.appendChild(a);
                a.click();
                URL.revokeObjectURL(downloadUrl);
                document.body.removeChild(a);
            } else {
                toast.error("Processing resulted in an empty file.");
            }
            cleanup();
        };

        const processFrame = () => {
            if (!video || video.paused || video.ended) {
                if (recorder?.state === "recording") recorder.stop();
                else cleanup();
                return;
            }
            
            const canvasCenter = FINAL_CANVAS_SIZE / 2;
            const videoRadius = VIDEO_CIRCLE_SIZE / 2;

            ctx.save();
            ctx.filter = 'blur(24px)';
            ctx.drawImage(video, 0, 0, FINAL_CANVAS_SIZE, FINAL_CANVAS_SIZE);
            ctx.filter = 'none';
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(0, 0, FINAL_CANVAS_SIZE, FINAL_CANVAS_SIZE);
            ctx.restore();

            ctx.save();
            ctx.beginPath();
            ctx.arc(canvasCenter, canvasCenter, videoRadius, 0, Math.PI * 2, true);
            ctx.clip();
            const vidSize = Math.min(video.videoWidth, video.videoHeight);
            const sx = (video.videoWidth - vidSize) / 2;
            const sy = (video.videoHeight - vidSize) / 2;
            ctx.drawImage(video, sx, sy, vidSize, vidSize, canvasCenter - videoRadius, canvasCenter - videoRadius, VIDEO_CIRCLE_SIZE, VIDEO_CIRCLE_SIZE);
            ctx.restore();

            const text = "Бульк";
            const numberOfTexts = 5;
            const textRadius = videoRadius + 38;
            const rotationSpeed = 8;
            const baseAngle = (video.currentTime / rotationSpeed) * Math.PI * 2;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.font = 'bold 36px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            for (let i = 0; i < numberOfTexts; i++) {
                const angleOffset = (i / numberOfTexts) * Math.PI * 2;
                const currentAngle = baseAngle + angleOffset;
                const x = canvasCenter + textRadius * Math.cos(currentAngle);
                const y = canvasCenter + textRadius * Math.sin(currentAngle);
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(currentAngle + Math.PI / 2);
                ctx.fillText(text, 0, 0);
                ctx.restore();
            }

            if (logoBitmap) {
                const logoSize = 80;
                const logoRadius = logoSize / 2;
                const logoX = FINAL_CANVAS_SIZE - logoRadius - 20;
                const logoY = FINAL_CANVAS_SIZE - logoRadius - 20;
                ctx.save();
                ctx.beginPath();
                ctx.arc(logoX, logoY, logoRadius, 0, Math.PI * 2, true);
                ctx.clip();
                ctx.drawImage(logoBitmap, logoX - logoRadius, logoY - logoRadius, logoSize, logoSize);
                ctx.restore();
            }
            
            animationFrameId = requestAnimationFrame(processFrame);
        };
        
        video.onended = () => {
            if (recorder?.state === "recording") {
                recorder.stop();
            }
        };
        
        video.currentTime = 0;
        await video.play();
        recorder.start();
        animationFrameId = requestAnimationFrame(processFrame);

    } catch (error) {
        cleanup();
        // If processing fails for any reason, offer direct download as a fallback.
        triggerDirectDownload(videoUrl);
        throw error; // Re-throw for console logging
    }
};
