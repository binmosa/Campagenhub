import React, { useState, useRef, useEffect } from 'react';
import { Camera, StopCircle, RefreshCw, Play, Trash2, CheckCircle, Video } from 'lucide-react';

interface VideoPitchRecorderProps {
  onRecordingComplete: (base64: string | null) => void;
  maxDuration?: number; // in seconds
}

export const VideoPitchRecorder: React.FC<VideoPitchRecorderProps> = ({ 
  onRecordingComplete, 
  maxDuration = 60 
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPermissionGranted, setIsPermissionGranted] = useState<boolean | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(maxDuration);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsPermissionGranted(true);
    } catch (err) {
      console.error('Error accessing camera:', err);
      setIsPermissionGranted(false);
    }
  };

  const startRecording = () => {
    chunksRef.current = [];
    const stream = videoRef.current?.srcObject as MediaStream;
    if (!stream) return;

    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setRecordedBlob(blob);
      setPreviewUrl(URL.createObjectURL(blob));
      
      // Convert to base64 for submission
      const reader = new FileReader();
      reader.onloadend = () => {
        onRecordingComplete(reader.result as string);
      };
      reader.readAsDataURL(blob);
    };

    recorder.start();
    setIsRecording(true);
    setTimeLeft(maxDuration);

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          stopRecording();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      
      // Stop all tracks to release camera
      const stream = videoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach(track => track.stop());
    }
  };

  const resetRecording = () => {
    setRecordedBlob(null);
    setPreviewUrl(null);
    onRecordingComplete(null);
    startCamera();
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      const stream = videoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach(track => track.stop());
    };
  }, []);

  if (isPermissionGranted === false) {
    return (
      <div className="p-8 text-center bg-red-50 rounded-2xl border border-red-100">
        <Video size={48} className="mx-auto text-red-400 mb-4" />
        <h3 className="text-lg font-bold text-red-900 mb-2">Camera Access Denied</h3>
        <p className="text-sm text-red-600">Please enable camera and microphone permissions in your browser to record a video pitch.</p>
        <button type="button" onClick={startCamera} className="mt-4 px-6 py-2 bg-red-600 text-white rounded-xl font-bold text-sm">
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl border-4 border-surface-100">
        {!previewUrl ? (
          <>
            <video 
              ref={videoRef} 
              autoPlay 
              muted 
              playsInline 
              className="w-full h-full object-cover mirror"
            />
            {isRecording && (
              <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600 text-white px-3 py-1.5 rounded-full text-xs font-bold animate-pulse">
                <div className="w-2 h-2 bg-white rounded-full" />
                REC • {timeLeft}s
              </div>
            )}
            {!isPermissionGranted && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-900/40 backdrop-blur-md text-white p-6 text-center">
                <Camera size={48} className="mb-4 opacity-50" />
                <h3 className="text-xl font-extrabold mb-2">Video Pitch Recording</h3>
                <p className="text-sm text-white/80 max-w-xs mb-6">Record a personal 1-minute intro to stand out to the brand!</p>
                <button 
                  type="button"
                  onClick={startCamera}
                  className="px-8 py-3 bg-brand-500 hover:bg-brand-400 text-white rounded-2xl font-extrabold shadow-xl transition-all"
                >
                  Enable Camera
                </button>
              </div>
            )}
            {isPermissionGranted && !isRecording && (
              <button 
                type="button"
                onClick={startRecording}
                className="absolute bottom-6 left-1/2 -translate-x-1/2 w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all group"
              >
                <div className="w-12 h-12 bg-red-600 rounded-full group-hover:scale-110 transition-transform" />
              </button>
            )}
            {isRecording && (
              <button 
                type="button"
                onClick={stopRecording}
                className="absolute bottom-6 left-1/2 -translate-x-1/2 w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all group"
              >
                <StopCircle size={32} className="text-red-600" />
              </button>
            )}
          </>
        ) : (
          <div className="w-full h-full relative">
            <video 
              src={previewUrl} 
              controls 
              className="w-full h-full object-cover"
            />
            <div className="absolute top-4 right-4 flex gap-2">
              <button 
                type="button"
                onClick={resetRecording}
                className="p-3 bg-white text-surface-900 rounded-2xl shadow-xl hover:bg-red-50 hover:text-red-600 transition-all"
                title="Delete and Retake"
              >
                <Trash2 size={20} />
              </button>
              <div className="p-3 bg-green-500 text-white rounded-2xl shadow-xl flex items-center gap-2 font-bold text-sm">
                <CheckCircle size={20} /> Recorded
              </div>
            </div>
          </div>
        )}
      </div>
      
      {!previewUrl && isPermissionGranted && (
        <div className="p-4 bg-brand-50 border border-brand-100 rounded-2xl flex items-center gap-3">
          <RefreshCw size={20} className="text-brand-500 shrink-0" />
          <p className="text-xs text-brand-700 font-medium leading-relaxed">
            Quick Tip: Introduce yourself, mention your niche, and explain why you're a great fit for this campaign!
          </p>
        </div>
      )}
    </div>
  );
};
