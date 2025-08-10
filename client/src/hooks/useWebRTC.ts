// useWebRTC.ts (упрощённый, адаптируй импорты)
import { useRef, useEffect } from "react";

export function useWebRTC({ onRemoteStream, signalingSocket }: { onRemoteStream: (stream: MediaStream) => void, signalingSocket: any }) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // Инициализация PeerConnection
    pcRef.current = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    pcRef.current.ontrack = (ev) => {
      onRemoteStream && onRemoteStream(ev.streams[0]);
    };

    // не закрываем pc при потере видимости страницы — только при явном hangup
    function handleVisibility() {
      if (document.hidden) {
        // НЕ останавливаем треки, просто делаем их enabled = true (чтобы не терять)
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(t => t.enabled = true);
        }
      } else {
        if (localStreamRef.current) {
          // при возвращении убедимся, что треки включены
          localStreamRef.current.getTracks().forEach(t => t.enabled = true);
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      // освобождаем ресурсы только если компонент уходит
      if (pcRef.current) {
        pcRef.current.getSenders().forEach(s => {
          try { s.track?.stop(); } catch (e) {}
        });
        pcRef.current.close();
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, [onRemoteStream]);

  async function startLocalStream(constraints = { video: true, audio: true }) {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    localStreamRef.current = stream;
    // add tracks to pc
    stream.getTracks().forEach(track => pcRef.current?.addTrack(track, stream));
    return stream;
  }

  async function hangup() {
    // здесь выполняем явное завершение — отправляем сигнал на сервер и закрываем
    try {
      signalingSocket.emit('hangup'); // если есть
    } finally {
      pcRef.current?.getSenders().forEach(s => s.track?.stop());
      pcRef.current?.close();
      pcRef.current = null;
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
      }
    }
  }

  return { startLocalStream, hangup, pcRef, localStreamRef };
}
