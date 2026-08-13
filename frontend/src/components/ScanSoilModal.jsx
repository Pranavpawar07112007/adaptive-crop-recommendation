import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Upload, X, Loader2, Image as ImageIcon, AlertCircle, CheckCircle2, Leaf, ThumbsUp, ThumbsDown, Info } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import CROP_DETAILS from '../data/cropDetailData';

const ScanSoilModal = ({ isOpen, onClose }) => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('camera'); // 'camera' or 'upload'
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  
  // Camera State
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraError, setCameraError] = useState(null);

  // Upload State
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  // Stop camera when unmounting or switching tabs/closing
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setCameraError('Camera access denied or unavailable. Please use the Upload option.');
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setScanResult(null);
      setError(null);
    }
    if (isOpen && activeTab === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen, activeTab, startCamera, stopCamera]);

  // Handle Tab Switch
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setError(null);
    setScanResult(null);
    if (tab === 'upload') {
      setSelectedFile(null);
      setPreviewUrl(null);
    }
  };

  // Convert File to Base64
  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });

  // Handle Capture from Video
  const handleCapture = async () => {
    if (!videoRef.current) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    
    const base64Image = canvas.toDataURL('image/jpeg', 0.8);
    await submitImage(base64Image, 'image/jpeg');
  };

  // Handle File Upload Change
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError("Please select a valid image file.");
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setError(null);
    }
  };

  const handleUploadSubmit = async () => {
    if (!selectedFile) return;
    const base64Image = await fileToBase64(selectedFile);
    await submitImage(base64Image, selectedFile.type);
  };

  const submitImage = async (base64Image, mimeType) => {
    setIsScanning(true);
    setError(null);
    stopCamera(); // Stop camera while scanning

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/vision/analyze-soil`,
        { image: base64Image, mimeType },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setScanResult(response.data);
    } catch (err) {
      console.error(err);
      const errorMessage = err.response?.data?.error || 'Failed to analyze image. Please try again.';
      setError(errorMessage);
      if (activeTab === 'camera') startCamera(); // Restart camera on fail
    } finally {
      setIsScanning(false);
    }
  };

  if (!isOpen) return null;

  // Assess Land Condition
  const getLandCondition = (result) => {
    if (!result) return null;
    const { N, P, K, pH } = result;
    
    const n = parseFloat(N);
    const p = parseFloat(P);
    const k = parseFloat(K);
    const ph = parseFloat(pH);

    const isNOptimal = n >= 80 && n <= 120;
    const isPOptimal = p >= 30 && p <= 60;
    const isKOptimal = k >= 30 && k <= 60;
    const isPhOptimal = ph >= 6.0 && ph <= 7.5;
    const isPhExtreme = ph < 5.0 || ph > 8.5;

    let numLow = 0;
    if (n < 80) numLow++;
    if (p < 30) numLow++;
    if (k < 30) numLow++;

    let verdict = "Moderate — Needs Improvement";
    let potential = "Medium Potential";
    let colorClass = "amber";

    if (isNOptimal && isPOptimal && isKOptimal && isPhOptimal) {
      verdict = "Good for Farming";
      potential = "High Potential";
      colorClass = "emerald";
    } else if (numLow >= 2 || isPhExtreme) {
      verdict = "Poor — Significant Amendment Needed";
      potential = "Low Potential";
      colorClass = "red";
    }

    let reason = "Soil nutrients and pH are well-balanced and within optimal ranges for most crops.";
    if (colorClass !== "emerald") {
      const issues = [];
      if (n < 80) issues.push("low Nitrogen");
      else if (n > 120) issues.push("excess Nitrogen");
      
      if (p < 30) issues.push("low Phosphorus");
      else if (p > 60) issues.push("excess Phosphorus");
      
      if (k < 30) issues.push("low Potassium");
      else if (k > 60) issues.push("excess Potassium");
      
      if (ph < 6.0) issues.push("acidic pH");
      else if (ph > 7.5) issues.push("alkaline pH");
      
      reason = `The soil has ${issues.join(', ')}, which affects nutrient absorption and limits fertility potential.`;
    }

    return { verdict, potential, reason, colorClass, n, p, k, ph };
  };



  const getRecommendations = (condition) => {
    if (!condition || condition.colorClass === 'emerald') return [];
    const recs = [];
    if (condition.ph < 6.0) recs.push("Consider agricultural lime application to reduce soil acidity.");
    if (condition.ph > 7.5) recs.push("Add organic matter or elemental sulfur to lower alkalinity.");
    if (condition.n < 80) recs.push("Apply nitrogen-rich fertilizers like Urea or plant leguminous cover crops.");
    if (condition.p < 30) recs.push("Add organic compost or DAP to boost Phosphorus levels.");
    if (condition.k < 30) recs.push("Apply MOP or wood ash to improve Potassium levels.");
    return recs.slice(0, 3);
  };

  const landCondition = getLandCondition(scanResult);
  const recommendations = landCondition ? getRecommendations(landCondition) : [];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        >
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="w-full max-w-lg glass-panel bg-white/90 dark:bg-[#111A0E]/95 overflow-hidden rounded-[2rem] shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-white/5">
              <h2 className="text-xl font-bold font-poppins flex items-center gap-2 text-slate-800 dark:text-white">
                <SparklesIcon isScanning={isScanning} /> AI Soil Scan
              </h2>
              <button onClick={onClose} disabled={isScanning} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Tabs */}
            {!scanResult && (
              <div className="flex px-6 pt-6 gap-2">
                <TabButton active={activeTab === 'camera'} onClick={() => handleTabChange('camera')} icon={<Camera className="w-4 h-4"/>} label="Camera" disabled={isScanning} />
                <TabButton active={activeTab === 'upload'} onClick={() => handleTabChange('upload')} icon={<Upload className="w-4 h-4"/>} label="Upload" disabled={isScanning} />
              </div>
            )}

            {/* Content Area */}
            <div className="p-6 overflow-y-auto min-h-0">
              {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 rounded-xl text-sm flex items-center gap-2 border border-red-100 dark:border-red-900/50">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
                </div>
              )}

              {scanResult ? (
                <div className="flex flex-col gap-4">
                  <div className="bg-slate-50 dark:bg-black/30 rounded-2xl p-5 border border-slate-200 dark:border-white/10">
                    <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" /> Analysis Results
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col bg-white dark:bg-slate-800/80 p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
                        <span className="text-xs text-slate-500 font-medium">Soil Type</span>
                        <span className="font-bold text-slate-800 dark:text-white capitalize">{scanResult.soilType || 'Unknown'}</span>
                      </div>
                      <div className="flex flex-col bg-white dark:bg-slate-800/80 p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
                        <span className="text-xs text-slate-500 font-medium">Nitrogen (N)</span>
                        <span className="font-bold text-slate-800 dark:text-white">
                          {scanResult.N ?? '--'} <span className="text-xs font-normal text-slate-500">({landCondition.n < 80 ? 'Low' : landCondition.n > 120 ? 'High' : 'Medium'})</span>
                        </span>
                      </div>
                      <div className="flex flex-col bg-white dark:bg-slate-800/80 p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
                        <span className="text-xs text-slate-500 font-medium">Phosphorus (P)</span>
                        <span className="font-bold text-slate-800 dark:text-white">
                          {scanResult.P ?? '--'} <span className="text-xs font-normal text-slate-500">({landCondition.p < 30 ? 'Low' : landCondition.p > 60 ? 'High' : 'Medium'})</span>
                        </span>
                      </div>
                      <div className="flex flex-col bg-white dark:bg-slate-800/80 p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
                        <span className="text-xs text-slate-500 font-medium">Potassium (K)</span>
                        <span className="font-bold text-slate-800 dark:text-white">
                          {scanResult.K ?? '--'} <span className="text-xs font-normal text-slate-500">({landCondition.k < 30 ? 'Low' : landCondition.k > 60 ? 'High' : 'Medium'})</span>
                        </span>
                      </div>
                      <div className="flex flex-col bg-white dark:bg-slate-800/80 p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 col-span-2">
                        <span className="text-xs text-slate-500 font-medium">pH Level</span>
                        <span className="font-bold text-slate-800 dark:text-white">
                          {scanResult.pH ?? '--'} <span className="text-xs font-normal text-slate-500">({landCondition.ph < 6.0 ? 'Acidic' : landCondition.ph > 7.5 ? 'Alkaline' : 'Neutral'})</span>
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {landCondition && (
                    <div className={`bg-${landCondition.colorClass}-50 dark:bg-${landCondition.colorClass}-900/20 rounded-2xl p-5 border border-${landCondition.colorClass}-200 dark:border-${landCondition.colorClass}-800/50`}>
                      <h3 className={`font-bold text-${landCondition.colorClass}-800 dark:text-${landCondition.colorClass}-300 mb-3 text-sm uppercase tracking-wider flex items-center gap-2`}>
                        {landCondition.colorClass === 'emerald' ? <ThumbsUp className="w-4 h-4" /> : <Info className="w-4 h-4" />} Soil Health Summary
                      </h3>
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Verdict</span>
                          <span className={`font-black text-${landCondition.colorClass}-700 dark:text-${landCondition.colorClass}-400`}>
                            {landCondition.verdict}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Fertility Potential</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {landCondition.potential}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700 dark:text-slate-300 mt-2 font-medium leading-relaxed">
                          {landCondition.reason}
                        </p>
                      </div>
                    </div>
                  )}


                  {recommendations.length > 0 && (
                    <div className="bg-white dark:bg-black/20 rounded-2xl p-5 border border-slate-200 dark:border-white/10">
                      <h3 className="font-bold text-slate-800 dark:text-white mb-3 flex items-center gap-2 text-sm uppercase tracking-wider">
                        <AlertCircle className="w-4 h-4 text-amber-500" /> Recommendations to Improve Soil
                      </h3>
                      <ul className="space-y-2">
                        {recommendations.map((rec, idx) => (
                          <li key={idx} className="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-2 font-medium">
                            <span className="text-amber-500 mt-0.5">•</span>
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="pt-2 flex flex-col gap-3">
                    <button 
                      onClick={() => {
                        navigate('/dashboard', { state: { scanData: scanResult } });
                        onClose();
                      }} 
                      className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 text-lg flex justify-center items-center gap-2"
                    >
                      <CheckCircle2 className="w-5 h-5" /> Use Values in Dashboard
                    </button>
                    <button onClick={onClose} className="w-full py-4 bg-slate-800 hover:bg-slate-900 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 font-bold rounded-xl shadow-lg transition-all active:scale-95 text-lg">
                      Close Report
                    </button>
                  </div>
                </div>
              ) : isScanning ? (
                <div className="h-64 flex flex-col items-center justify-center gap-4 bg-slate-50 dark:bg-black/20 rounded-2xl border border-dashed border-emerald-300 dark:border-emerald-700/50">
                   <div className="relative">
                      <div className="absolute inset-0 border-4 border-emerald-500/20 rounded-full animate-ping"></div>
                      <Loader2 className="w-12 h-12 text-emerald-500 animate-spin relative z-10" />
                   </div>
                   <p className="font-bold text-emerald-600 dark:text-emerald-400 font-mono animate-pulse">Analyzing with Gemini AI...</p>
                </div>
              ) : activeTab === 'camera' ? (
                <div className="flex flex-col gap-4">
                  {cameraError ? (
                    <div className="h-64 flex flex-col items-center justify-center gap-2 bg-slate-100 dark:bg-black/20 rounded-2xl border border-slate-200 dark:border-white/10 text-center p-4">
                      <Camera className="w-8 h-8 text-slate-400" />
                      <p className="text-sm text-slate-500">{cameraError}</p>
                    </div>
                  ) : (
                    <div className="relative rounded-2xl overflow-hidden bg-black h-64 shadow-inner">
                      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                      <div className="absolute inset-0 border-[3px] border-emerald-500/30 rounded-2xl pointer-events-none"></div>
                      {/* Viewfinder crosshairs */}
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 border-2 border-white/50 rounded-lg pointer-events-none"></div>
                    </div>
                  )}
                  <button 
                    onClick={handleCapture} 
                    disabled={!!cameraError}
                    className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/30 transition-all active:scale-95 flex justify-center items-center gap-2 disabled:opacity-50 disabled:active:scale-100"
                  >
                    <Camera className="w-5 h-5" /> Capture & Analyze
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {!previewUrl ? (
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="h-64 flex flex-col items-center justify-center gap-3 bg-slate-50 hover:bg-slate-100 dark:bg-black/20 dark:hover:bg-black/40 cursor-pointer rounded-2xl border-2 border-dashed border-slate-300 dark:border-white/20 transition-colors group"
                    >
                      <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <ImageIcon className="w-8 h-8 text-emerald-500" />
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-slate-700 dark:text-slate-300">Click to upload image</p>
                        <p className="text-xs text-slate-500 mt-1">JPEG, PNG, WEBP (Max 5MB)</p>
                      </div>
                    </div>
                  ) : (
                    <div className="relative rounded-2xl overflow-hidden bg-black h-64 shadow-inner group">
                       <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                       <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button onClick={() => { setSelectedFile(null); setPreviewUrl(null); }} className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg backdrop-blur-md text-sm font-bold">
                            Choose Different Image
                          </button>
                       </div>
                    </div>
                  )}
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                  <button 
                    onClick={handleUploadSubmit} 
                    disabled={!selectedFile}
                    className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/30 transition-all active:scale-95 flex justify-center items-center gap-2 disabled:opacity-50 disabled:active:scale-100"
                  >
                    <Upload className="w-5 h-5" /> Upload & Analyze
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const TabButton = ({ active, onClick, icon, label, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${
      active 
        ? 'bg-white dark:bg-black shadow text-emerald-600 dark:text-emerald-400' 
        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
  >
    {icon} {label}
  </button>
);

const SparklesIcon = ({ isScanning }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-emerald-500 ${isScanning ? 'animate-spin' : ''}`}>
    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
  </svg>
);

export default ScanSoilModal;
