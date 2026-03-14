"use client";

import React, { useRef, useEffect, useState } from "react";

export interface MultiCameraCaptureProps {
  onCapture: (images: string[]) => void; // Returns array of 5 captured images
}

const directions = ["Front", "Left", "Right", "Up", "Down"];

const MultiCameraCapture: React.FC<MultiCameraCaptureProps> = ({ onCapture }) => {
  const [mode, setMode] = useState<"camera" | "upload">("camera");

  // Camera state
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraStatus, setCameraStatus] = useState<"loading" | "active" | "stopped">("stopped");
  const [cameraError, setCameraError] = useState<string>("");
  const [currentStep, setCurrentStep] = useState(0);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);

  // Upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [uploadError, setUploadError] = useState<string>("");

  // Start camera
  const startCamera = async () => {
    try {
      setCameraStatus("loading");
      setCameraError("");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }
      });

      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraStatus("active");
    } catch (err) {
      console.error("Error accessing camera:", err);
      setCameraError("Failed to access camera. Please check permissions.");
      setCameraStatus("stopped");
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraStatus("stopped");
  };

  useEffect(() => {
    if (mode === "camera") {
      startCamera();
    }
    return () => stopCamera();
  }, [mode]);

  const switchMode = (newMode: "camera" | "upload") => {
    if (newMode === mode) return;
    // Stop camera when switching to upload
    if (newMode === "upload") {
      stopCamera();
    }
    // Reset state
    setCapturedImages([]);
    setCurrentStep(0);
    setUploadedImages([]);
    setUploadError("");
    setCameraError("");
    setMode(newMode);
  };

  // Camera capture
  const captureImage = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || cameraStatus !== "active") return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);

    const updatedImages = [...capturedImages, dataUrl];
    setCapturedImages(updatedImages);
    setCurrentStep(currentStep + 1);

    if (updatedImages.length === directions.length) {
      onCapture(updatedImages);
    }
  };

  // File upload handling
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setUploadError("");

    const fileArray = Array.from(files);

    // Validate count
    if (fileArray.length !== 5) {
      setUploadError(`Please select exactly 5 photos. You selected ${fileArray.length}.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Validate file types
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    const invalidFile = fileArray.find(f => !validTypes.includes(f.type));
    if (invalidFile) {
      setUploadError(`Invalid file type: ${invalidFile.name}. Please use JPEG, PNG, or WebP images.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Validate file sizes (max 10MB each)
    const oversizedFile = fileArray.find(f => f.size > 10 * 1024 * 1024);
    if (oversizedFile) {
      setUploadError(`File too large: ${oversizedFile.name}. Max size is 10MB per image.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Read all files as data URLs
    const readPromises = fileArray.map(file => {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
        reader.readAsDataURL(file);
      });
    });

    Promise.all(readPromises)
      .then(dataUrls => {
        setUploadedImages(dataUrls);
      })
      .catch(err => {
        setUploadError(`Error reading files: ${err.message}`);
      });
  };

  const removeUploadedImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const submitUploadedImages = () => {
    if (uploadedImages.length !== 5) {
      setUploadError("Please upload exactly 5 photos before submitting.");
      return;
    }
    onCapture(uploadedImages);
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Mode Toggle */}
      <div className="flex rounded-xl overflow-hidden border-2 border-slate-200 shadow-sm">
        <button
          onClick={() => switchMode("camera")}
          className={`px-6 py-2.5 font-semibold text-sm transition-all duration-300 flex items-center gap-2 ${
            mode === "camera"
              ? "bg-blue-600 text-white shadow-inner"
              : "bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Camera
        </button>
        <button
          onClick={() => switchMode("upload")}
          className={`px-6 py-2.5 font-semibold text-sm transition-all duration-300 flex items-center gap-2 ${
            mode === "upload"
              ? "bg-blue-600 text-white shadow-inner"
              : "bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Upload Photos
        </button>
      </div>

      {/* ===== CAMERA MODE ===== */}
      {mode === "camera" && (
        <>
          {/* Camera Status */}
          <div className="flex items-center space-x-2 text-sm">
            <div
              className={`w-3 h-3 rounded-full ${
                cameraStatus === "active"
                  ? "bg-green-500"
                  : cameraStatus === "loading"
                  ? "bg-yellow-500 animate-pulse"
                  : "bg-red-500"
              }`}
            ></div>
            <span className="text-gray-600">
              {cameraStatus === "active"
                ? "Camera Active"
                : cameraStatus === "loading"
                ? "Starting Camera..."
                : "Camera Stopped"}
            </span>
          </div>

          {/* Video */}
          <div className="relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`rounded-lg shadow-md w-full max-w-md ${
                cameraStatus === "active" ? "block" : "hidden"
              }`}
              style={{ maxHeight: "360px" }}
            />

            {cameraStatus === "loading" && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-200 rounded-lg">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-gray-600">Starting camera...</p>
                </div>
              </div>
            )}

            {cameraStatus === "stopped" && (
              <div className="flex items-center justify-center bg-gray-100 rounded-lg w-full max-w-md h-60">
                <p className="text-gray-600">Camera is stopped</p>
              </div>
            )}
          </div>

          <canvas ref={canvasRef} className="hidden" />

          {cameraError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded max-w-md">
              <p className="text-sm">{cameraError}</p>
              <button
                onClick={startCamera}
                className="mt-2 text-sm bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
              >
                Retry
              </button>
            </div>
          )}

          {cameraStatus === "active" && currentStep < directions.length && (
            <div className="text-center text-white space-y-2">
              <p className="text-lg">
                Please look: <span className="font-bold">{directions[currentStep]}</span>
              </p>
              <button
                onClick={captureImage}
                className="px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                Capture
              </button>
            </div>
          )}

          {currentStep >= directions.length && (
            <div className="text-center text-green-400">
              <p>All 5 images captured successfully!</p>
            </div>
          )}
        </>
      )}

      {/* ===== UPLOAD MODE ===== */}
      {mode === "upload" && (
        <div className="w-full max-w-lg space-y-4">
          {uploadedImages.length === 0 ? (
            /* Drop zone / file picker */
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all duration-300"
            >
              <svg className="w-12 h-12 mx-auto text-slate-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-slate-700 font-semibold text-lg mb-1">Click to upload 5 photos</p>
              <p className="text-slate-500 text-sm">
                Select exactly 5 face photos (JPEG, PNG, or WebP, max 10MB each)
              </p>
              <p className="text-slate-400 text-xs mt-2">
                Tip: Use photos from different angles (front, left, right, up, down) for best results
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          ) : (
            /* Image preview grid */
            <div className="space-y-4">
              <div className="grid grid-cols-5 gap-2">
                {uploadedImages.map((img, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={img}
                      alt={`Photo ${index + 1}`}
                      className="w-full aspect-square object-cover rounded-lg border-2 border-slate-200 shadow-sm"
                    />
                    <button
                      onClick={() => removeUploadedImage(index)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center shadow-md hover:bg-red-600"
                    >
                      X
                    </button>
                    <span className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
                      {directions[index] || `#${index + 1}`}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setUploadedImages([]);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-sm border border-slate-300 transition-all duration-200"
                >
                  Re-select Photos
                </button>
                <button
                  onClick={submitUploadedImages}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  Submit 5 Photos
                </button>
              </div>
            </div>
          )}

          {uploadError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              <p className="text-sm">{uploadError}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MultiCameraCapture;
