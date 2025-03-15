import React, { useRef, useState, useEffect } from "react";
import axios from "axios";
import './App.css';

function App() {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [emotion, setEmotion] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [cameraActive, setCameraActive] = useState(false);
    const [debugImage, setDebugImage] = useState(null);
    const [consecutiveFailures, setConsecutiveFailures] = useState(0);
    const [debugInfo, setDebugInfo] = useState(null);
    const [autoCapture, setAutoCapture] = useState(false);
    const autoCaptureRef = useRef(null);
    const [theme, setTheme] = useState('dark');

    useEffect(() => {
        // Apply theme to body
        document.body.className = theme;
        
        // Cleanup function to stop camera and auto-capture when component unmounts
        return () => {
            stopCamera();
            stopAutoCapture();
        };
    }, [theme]);

    // Effect for auto-capture
    useEffect(() => {
        if (autoCapture && cameraActive) {
            startAutoCapture();
        } else {
            stopAutoCapture();
        }
        
        return () => stopAutoCapture();
    }, [autoCapture, cameraActive]);

    const startCamera = () => {
        setError(null);
        navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: "user" 
            } 
        })
        .then(stream => {
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                setCameraActive(true);
            }
        })
        .catch(err => {
            console.error("Error accessing webcam:", err);
            setError(`Camera error: ${err.message}`);
        });
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const tracks = videoRef.current.srcObject.getTracks();
            tracks.forEach(track => track.stop());
            videoRef.current.srcObject = null;
            setCameraActive(false);
        }
        stopAutoCapture();
    };

    const startAutoCapture = () => {
        stopAutoCapture(); // Clear any existing interval
        
        autoCaptureRef.current = setInterval(() => {
            captureImage();
        }, 2000); // Capture every 2 seconds
    };

    const stopAutoCapture = () => {
        if (autoCaptureRef.current) {
            clearInterval(autoCaptureRef.current);
            autoCaptureRef.current = null;
        }
    };

    const toggleAutoCapture = () => {
        setAutoCapture(prev => !prev);
    };

    const toggleTheme = () => {
        setTheme(prevTheme => prevTheme === 'dark' ? 'light' : 'dark');
    };

    const captureImage = async () => {
        if (!cameraActive) {
            setError("Camera is not active. Please start the camera first.");
            return;
        }

        setIsLoading(true);
        
        try {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            if (!video || !canvas) return;
            
            const context = canvas.getContext("2d");

            // Match the canvas size to the video size
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Display the captured image for debugging
            setDebugImage(canvas.toDataURL('image/jpeg'));
            
            canvas.toBlob(async (blob) => {
                const formData = new FormData();
                formData.append("image", blob, "frame.jpg");

                try {
                    console.log("Sending image to server...");
                    const response = await axios.post("https://face-expression-detector-backend.onrender.com/predict", formData, {
                        headers: { "Content-Type": "multipart/form-data" }
                    });
                    
                    console.log("Server response:", response.data);
                    setDebugInfo(response.data.debug_info);
                    
                    if (response.data.error) {
                        setError(response.data.error);
                        setEmotion("");
                        setConsecutiveFailures(prev => prev + 1);
                    } else if (response.data.results && response.data.results.length > 0) {
                        // Use the first face result
                        const firstResult = response.data.results[0];
                        setEmotion(`${firstResult.emotion} (${(firstResult.confidence * 100).toFixed(1)}%)`);
                        
                        // Draw rectangle on debug image
                        const pos = firstResult.position;
                        context.strokeStyle = "#00FF00";
                        context.lineWidth = 3;
                        context.strokeRect(pos.x, pos.y, pos.width, pos.height);
                        
                        // Add text
                        context.font = "20px Arial";
                        context.fillStyle = "#00FF00";
                        context.fillText(
                            `${firstResult.emotion} (${(firstResult.confidence * 100).toFixed(1)}%)`, 
                            pos.x, 
                            pos.y > 30 ? pos.y - 10 : pos.y + pos.height + 20
                        );
                        
                        // Update debug image with rectangle and text
                        setDebugImage(canvas.toDataURL('image/jpeg'));
                        setConsecutiveFailures(0);
                    } else {
                        setError("No faces detected in the image");
                        setEmotion("");
                        setConsecutiveFailures(prev => prev + 1);
                    }
                } catch (error) {
                    console.error("Error predicting emotion:", error);
                    setError(`Server error: ${error.message}`);
                    setEmotion("");
                    setConsecutiveFailures(prev => prev + 1);
                } finally {
                    setIsLoading(false);
                }
            }, "image/jpeg", 0.95); // High quality JPEG
        } catch (err) {
            console.error("Error capturing image:", err);
            setError(`Capture error: ${err.message}`);
            setIsLoading(false);
            setConsecutiveFailures(prev => prev + 1);
        }
    };

    return (
        <div className={`app-container ${theme}`}>
            <div className="header">
                <h1>Facial Expression Detection</h1>
                <button className="theme-toggle" onClick={toggleTheme}>
                    {theme === 'dark' ? '☀️' : '🌙'}
                </button>
            </div>
            
            <div className="main-content">
                <div className="panel camera-panel">
                    <div className="panel-header">
                        <h2>Camera Feed</h2>
                    </div>
                    <div className="video-container">
                        {!cameraActive && (
                            <div className="camera-placeholder">
                                <div className="camera-icon">📷</div>
                                <p>Camera inactive</p>
                            </div>
                        )}
                        <video 
                            ref={videoRef} 
                            autoPlay 
                            playsInline
                            className={!cameraActive ? 'hidden' : ''}
                        ></video>
                    </div>
                    
                    <div className="controls">
                        {!cameraActive ? (
                            <button 
                                onClick={startCamera}
                                className="btn btn-primary"
                            >
                                <span className="btn-icon">▶️</span> Start Camera
                            </button>
                        ) : (
                            <>
                                <button 
                                    onClick={stopCamera}
                                    className="btn btn-danger"
                                >
                                    <span className="btn-icon">⏹️</span> Stop Camera
                                </button>
                                <button 
                                    onClick={captureImage}
                                    disabled={isLoading}
                                    className="btn btn-success"
                                >
                                    <span className="btn-icon">📸</span> 
                                    {isLoading ? 'Processing...' : 'Capture & Analyze'}
                                </button>
                                <button 
                                    onClick={toggleAutoCapture}
                                    className={`btn ${autoCapture ? 'btn-warning' : 'btn-secondary'}`}
                                >
                                    <span className="btn-icon">{autoCapture ? '⏸️' : '🔄'}</span>
                                    {autoCapture ? 'Stop Auto-Capture' : 'Start Auto-Capture'}
                                </button>
                            </>
                        )}
                    </div>
                </div>
                
                <div className="panel results-panel">
                    <div className="panel-header">
                        <h2>Results</h2>
                    </div>
                    
                    {emotion && (
                        <div className="emotion-result">
                            <h3>Detected Emotion:</h3>
                            <div className="emotion-display">{emotion}</div>
                        </div>
                    )}
                    
                    {error && (
                        <div className="error-message">
                            <strong>Error:</strong> {error}
                        </div>
                    )}
                    
                    {debugInfo && (
                        <div className="debug-info">
                            <h3>Detection Info:</h3>
                            <p>Strategy: {debugInfo.strategy}</p>
                            <p>Faces found: {debugInfo.faces_found}</p>
                        </div>
                    )}
                    
                    {debugImage && (
                        <div className="captured-image">
                            <h3>Processed Image:</h3>
                            <img 
                                src={debugImage} 
                                alt="Captured frame" 
                            />
                        </div>
                    )}
                </div>
            </div>
            
            <div className="footer">
                <p>Facial Expression Recognition System • {new Date().getFullYear()}</p>
                <br></br>
                <p>Developed by: <a href="https://www.linkedin.com/in/angelshinh/">Angel Shinh</a></p>
            </div>
            
            <canvas ref={canvasRef} style={{ display: "none" }}></canvas>
        </div>
    );
}

export default App;