"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Camera, ArrowLeft, Play, Square, User, Calendar, BookOpen, Users, CheckCircle2 } from "lucide-react";
export interface FaceData {
  box: [number, number, number, number];
  match: { user_id: string; name: string } | null;
  confidence?: number;
}
export default function DemoSessionPage() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [recognitionStarted, setRecognitionStarted] = useState(false);
  const [status, setStatus] = useState("");
  const [facesData, setFacesData] = useState<FaceData[]>([]);

  const [recognizedStudents, setRecognizedStudents] = useState<string[]>([]);
  const [confirmText, setConfirmText] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [cameraStatus, setCameraStatus] = useState<"loading" | "active" | "stopped">("stopped");
  const [cameraError, setCameraError] = useState<string>("");


  const startCamera = async () => {
    try {
      setCameraStatus("loading");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraStatus("active");
    } catch (err) {
      console.error("Camera error:", err);
      setCameraError("Failed to access camera.");
      setCameraStatus("stopped");
    }
  };

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject as MediaStream;
    stream?.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    if (intervalRef.current) clearInterval(intervalRef.current);
    setCameraStatus("stopped");
    
  };

  const captureAndRecognize = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || cameraStatus !== "active") return;

    // 1. Prepare Canvas
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 2. Take Snapshot
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageDataUrl = canvas.toDataURL("image/jpeg", 0.8);

    // 3. Send to API
    const payload: any = { image: imageDataUrl };
    if (sessionId) payload.session_id = sessionId;

    try {
      const res = await fetch("http://localhost:5000/api/attendance/real-mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.faces && data.faces.length > 0) {
        setFacesData(data.faces);
        const face = data.faces[0];
        if (face.match) {
          setStatus(`✅ Recognized ${face.match.name}`);
          setRecognizedStudents((prev) => 
            prev.includes(face.match.name) ? prev : [...prev, face.match.name]
          );
        }
      } else {
        setFacesData([]);
      }
    } catch (err) {
      console.error("Recognition error:", err);
    }
  }, [sessionId, cameraStatus]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (sessionId) {
        e.preventDefault();
        e.returnValue = ""; 
      }
    };
  
    // Attach the listener
    window.addEventListener("beforeunload", handleBeforeUnload);
  
    // Clean up the listener when the component unmounts
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [sessionId]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
  
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || facesData.length === 0) {
        if(canvas) {
            const ctx = canvas.getContext("2d");
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
        }
        return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    facesData.forEach((face) => {
      const [x, y, w, h] = face.box;
      ctx.strokeStyle = face.match ? "#00ff00" : "#ff0000";
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, w, h);

      ctx.fillStyle = face.match ? "#00ff00" : "#ff0000";
      ctx.font = "bold 16px Arial";
      const label = face.match ? face.match.name : "Unknown";
      ctx.fillText(label, x, y > 20 ? y - 10 : y + 20);
    });
  }, [facesData]);

  useEffect(() => {
    if (recognitionStarted && cameraStatus === "active") {
      intervalRef.current = setInterval(captureAndRecognize, 2000); // 2 seconds
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [recognitionStarted, cameraStatus, captureAndRecognize]);

  

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    }
  };

  const [form, setForm] = useState({
    date: "",
    subject: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    }
  };

  const endSessionAndNavigate = async () => {
    if (confirmText.toLowerCase() !== "sudo") {
      setStatus("Please type the secret word to finalize.");
      return;
    }
    // 1. Show the confirmation dialog
    const confirmed = window.confirm("Are you sure you want to end the session? This will finalize the attendance records.");
    if (!confirmed) {
      return
    }
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
    // 4. Proceed with ending the session on the backend
    if (sessionId) {
      try {
        setStatus("Closing session...");
        const res = await fetch("http://localhost:5000/api/attendance/end_session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        });
        
        const data = await res.json();
        if (data.success) {
          console.log("Session ended successfully:", data.statistics);
        }
      } catch (err) {
        console.error("Error ending session:", err);
      }
    }
  
    // 5. Navigate away
    const userType = localStorage.getItem("userType");
    const targetPath = userType === "teacher" ? "/teacher/dashboard" : "/dashboard";
    router.push(targetPath);
  };

  const createSession = async () => {
    if (!form.date || !form.subject) {
      setStatus("Please fill all fields");
      return;
    }

    setStatus("Creating session...");
    try {
      const res = await fetch("http://localhost:5000/api/attendance/create_session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.session_id) {
        setSessionId(data.session_id);
        setStatus("✅ Session created! Click Start Recognition.");
      } else {
        setStatus("❌ Failed to create session");
      }
    } catch (err) {
      console.error(err);
      setStatus("❌ Error creating session");
    }
    toggleFullScreen();
    console.log("Starting full screen")
  };

  const handleRecognize = useCallback(
    async (imageDataUrl: string) => {
      // Build payload: include session_id when available, otherwise include filters for demo recognition
      const payload: any = { image: imageDataUrl };
      if (sessionId) payload.session_id = sessionId;

      try {
        const res = await fetch("http://localhost:5000/api/attendance/real-mark", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();

        if (data.faces && data.faces.length > 0) {
          const face = data.faces[0];
          if (face.match) {
            setStatus(`✅ Recognized ${face.match.name}`);
            setRecognizedStudents((prev) => (prev.includes(face.match.name) ? prev : [...prev, face.match.name]));
          } else {
            setStatus("❌ Face not recognized");
          }
          setFacesData(data.faces.map((f: FaceData) => ({ box: f.box, match: f.match })));
        } else {
          setStatus("❌ No faces detected");
          setFacesData([]);
        }
      } catch (err) {
        console.error(err);
        setStatus("❌ Recognition failed");
        setFacesData([]);
      }
    },
    [sessionId]
    // [sessionId, form]
  );

  const handleStartRecognition = () => {
    setRecognitionStarted(true);
    startCamera();
    setStatus("Turn on camera when ready");
  };

  const handleStopRecognition = () => {
    setRecognitionStarted(false);
    stopCamera();
    setStatus("Recognition stopped");
  };

  

  return (
    <div className="min-h-screen bg-white">

      {/* Header */}
      <header className="bg-[#212121]">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Left Section */}
            <div className="flex items-center gap-4">
            {!sessionId && (
              <button
                onClick={() => router.push("/teacher/dashboard")}
                className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors group"
              >
                <ArrowLeft className="w-6 h-6 text-gray-600 group-hover:text-gray-800 transition-colors" />
              </button>
              )}
              
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-green-100 to-emerald-100 rounded-lg">
                  <Camera className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">Attendance Session</h1>
                  <p className="text-white text-sm">Live face recognition attendance</p>
                </div>
              </div>
            </div>

            {/* Status Indicator */}
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                recognitionStarted 
                  ? "bg-green-100 border border-green-300" 
                  : "bg-gray-100 border border-gray-300"
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  recognitionStarted ? "bg-green-600 animate-pulse" : "bg-gray-400"
                }`} />
                <span className={`text-sm font-medium ${
                  recognitionStarted ? "text-green-700" : "text-gray-600"
                }`}>
                  {recognitionStarted ? "LIVE" : "SETUP"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Controls */}
      <div className="px-6 py-4 border-b border-gray-200/50 bg-white/60 backdrop-blur-lg relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
      {/* Left Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        {sessionId && recognitionStarted && (
        <button
          onClick={handleStopRecognition}
          className="px-6 py-3 rounded-lg font-semibold bg-red-100 hover:bg-red-200 text-red-700 border-2 border-red-300 transition-all duration-300 flex items-center justify-center gap-3 hover:shadow-md hover:-translate-y-0.5"
        >
          <Square className="w-5 h-5" />
          Stop Recognition
        </button>
      )}
        {sessionId && (
          <div className="flex items-center gap-2 bg-white/50 p-1 rounded-lg border border-blue-200">
            <input
              type="text"
              placeholder="Type the secret code"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="text-black font-medium px-3 py-2 rounded-md border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-40"
            />
            <button
              onClick={endSessionAndNavigate}
              disabled={confirmText.toLowerCase() !== "sudo"}
              className={`px-3 py-1 rounded-lg font-semibold transition-all duration-300 flex items-center justify-center gap-3 hover:shadow-md 
                ${confirmText.toLowerCase() === "sudo" 
                  ? "bg-blue-600 text-white hover:bg-blue-700 border-2 border-blue-700 hover:-translate-y-0.5" 
                  : "bg-gray-200 text-gray-400 border-2 border-gray-300 cursor-not-allowed"}`}
            >
              <CheckCircle2 className="w-5 h-5" />
              Finalize Session
            </button>
          </div>
        )}
        {sessionId && !isFullscreen && (
        <button
          onClick={handleToggleFullscreen}
          className="p-2 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-700 border border-amber-300 transition-all flex items-center gap-2 text-sm font-medium"
          title="Go Fullscreen"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
          Maximize
        </button>
      )}
      </div>

            {/* Right Stats */}
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/70 border border-gray-200">
                <span className="text-gray-600">Status:</span>
                <span className={`font-medium ${
                  recognitionStarted ? "text-green-600" : 
                  sessionId ? "text-amber-600" : "text-gray-600"
                }`}>
                  {recognitionStarted ? "Active" : sessionId ? "Ready" : "Setup"}
                </span>
              </div>
              
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/70 border border-gray-200">
                <span className="text-gray-600">Students:</span>
                <span className="font-medium text-gray-800">
                  {recognizedStudents.length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="p-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          {!sessionId ? (
            /* Session Creation Form */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Form Section */}
              <div className="bg-white/70 backdrop-blur-lg rounded-xl border-2 border-blue-200 p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-gradient-to-r from-blue-100 to-purple-100 rounded-lg">
                    <Calendar className="w-5 h-5 text-blue-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-800">Create Attendance Session</h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-gray-700 text-sm mb-2 block font-medium">Date</label>
                    <input 
                      type="date" 
                      name="date" 
                      value={form.date} 
                      onChange={handleChange}
                      className="w-full p-3 rounded-lg bg-white/60 border border-gray-200 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                    />
                  </div>

                  <div>
                    <label className="text-gray-700 text-sm mb-2 block font-medium">Subject</label>
                    <input 
                      type="text" 
                      name="subject" 
                      placeholder="Enter subject name"
                      value={form.subject} 
                      onChange={handleChange}
                      className="w-full p-3 rounded-lg bg-white/60 border border-gray-200 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                    />
                  </div>

                  <button 
                    onClick={createSession}
                    className="w-full py-3 px-4 rounded-lg font-semibold bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white transition-all duration-300 flex items-center justify-center gap-3 mt-6 hover:shadow-lg hover:-translate-y-0.5"
                  >
                    <Calendar className="w-5 h-5" />
                    Create Session
                  </button>

                  {status && (
                    <div className={`p-3 rounded-lg text-center ${
                      status.includes("✅") ? "bg-green-100 border border-green-300 text-green-700" :
                      status.includes("❌") ? "bg-red-100 border border-red-300 text-red-700" :
                      "bg-blue-100 border border-blue-300 text-blue-700"
                    }`}>
                      {status}
                    </div>
                  )}
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-white/70 backdrop-blur-lg rounded-xl border-2 border-purple-200 p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg">
                    <BookOpen className="w-5 h-5 text-purple-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-800">How to Start</h2>
                </div>

                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-purple-50 border border-purple-200">
                    <h4 className="text-gray-800 font-medium mb-2">Session Setup</h4>
                    <ul className="text-gray-600 text-sm space-y-2">
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                        Fill in all the session details
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                        Click &quot;Create Session&quot; to initialize
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                        Start face recognition when ready
                      </li>
                    </ul>
                  </div>

                  <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                    <h4 className="text-gray-800 font-medium mb-2">During Session</h4>
                    <ul className="text-gray-600 text-sm space-y-2">
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                        Students face the camera clearly
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                        Attendance is marked automatically
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                        View recognized students in real-time
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Session Active View */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Camera Section */}
              <div className="bg-white/70 backdrop-blur-lg rounded-xl border-2 border-purple-200 p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg">
                    <Camera className="w-5 h-5 text-purple-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-800">Live Camera Feed</h2>
                </div>

                {!recognitionStarted ? (
                  <div className="text-center py-12 rounded-lg bg-gray-50 border border-gray-200">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Play className="w-10 h-10 text-gray-600" />
                    </div>
                    <p className="text-gray-600 font-medium mb-4">Ready to start recognition</p>
                    <button
                      onClick={handleStartRecognition}
                      className="px-6 py-3 rounded-lg font-semibold bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white transition-all duration-300 flex items-center justify-center gap-3 mx-auto hover:shadow-lg hover:-translate-y-0.5"
                    >
                      <Play className="w-5 h-5" />
                      Start Recognition
                    </button>
                  </div>
                ) : (
                  <div className="relative rounded-lg overflow-hidden bg-gray-50 border border-gray-200">
                    <div className="relative w-full max-w-md">
                          <video
                            ref={videoRef}
                            autoPlay
                            muted
                            playsInline
                            className={`rounded-lg shadow-md w-full ${cameraStatus === "active" ? "block" : "hidden"}`}
                            style={{ maxHeight: "360px" }}
                          />
                          <canvas ref={canvasRef} className="absolute top-0 left-0 rounded-lg w-full" />
                          {cameraStatus === "stopped" && !cameraError && (
                            <button
                              onClick={startCamera}
                              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-blue-600 text-white px-4 py-2 rounded"
                            >
                              Start Camera
                            </button>
                          )}
                          {cameraError && (
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-red-600">
                              {cameraError}
                            </div>
                          )}
                        </div>
                  </div>
                )}
              </div>

              {/* Results Section */}
              <div className="space-y-6">
                {/* Status Card */}
                <div className="bg-white/70 backdrop-blur-lg rounded-xl border-2 border-blue-200 p-6 shadow-lg">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-gradient-to-r from-blue-100 to-cyan-100 rounded-lg">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-800">Session Status</h2>
                  </div>

                  <div className={`p-4 rounded-lg border-2 transition-all ${
                    status.includes("✅") ? "bg-green-100 border-green-300" :
                    status.includes("❌") ? "bg-red-100 border-red-300" :
                    "bg-blue-100 border-blue-300"
                  }`}>
                    <p className={`font-semibold text-center ${
                      status.includes("✅") ? "text-green-700" :
                      status.includes("❌") ? "text-red-700" :
                      "text-blue-700"
                    }`}>
                      {status || "Waiting for recognition..."}
                    </p>
                  </div>
                </div>

                {/* Recognized Students */}
                <div className="bg-white/70 backdrop-blur-lg rounded-xl border-2 border-green-200 p-6 shadow-lg">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-gradient-to-r from-green-100 to-emerald-100 rounded-lg">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-800">Recognized Students</h2>
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-sm rounded-lg">
                      {recognizedStudents.length}
                    </span>
                  </div>

                  {recognizedStudents.length > 0 ? (
                    <div className="max-h-64 overflow-y-auto">
                      <div className="space-y-2">
                        {recognizedStudents.map((student, index) => (
                          <div
                            key={student}
                            className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-200 hover:bg-green-100 transition-colors"
                          >
                            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-gray-800 font-medium truncate">{student}</p>
                              <p className="text-green-600 text-xs">Attendance marked</p>
                            </div>
                            <div className="text-gray-500 text-sm flex-shrink-0">
                              #{index + 1}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 rounded-lg bg-gray-50 border border-gray-200">
                      <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-600">No students recognized yet</p>
                      <p className="text-gray-500 text-sm mt-1">Students will appear here when recognized</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
