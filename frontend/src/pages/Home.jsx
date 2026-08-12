import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Sprout, Activity, DollarSign, ArrowRight, Globe, Mic, LineChart, Scan, FlaskConical, BookOpen, CloudRain } from 'lucide-react';
import { useAuth } from '../context/AuthContext';


const Home = () => {
  
  const { isAuthenticated } = useAuth();
  const containerRef = useRef(null);
  
  // Track scroll progress within the container
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  });

  // 3D Transforms based on scroll
  const headerY = useTransform(scrollYProgress, [0, 1], [0, 400]);
  const headerOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const headerScale = useTransform(scrollYProgress, [0, 0.5], [1, 0.8]);
  const headerRotateX = useTransform(scrollYProgress, [0, 0.5], [0, 25]);

  const cardsY = useTransform(scrollYProgress, [0, 1], [100, -100]);
  
  return (
    <div ref={containerRef} className="relative min-h-[150vh] overflow-hidden perspective-1000">
      {/* Background Decor */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[20%] left-[10%] w-96 h-96 bg-emerald-500/20 rounded-full blur-[120px] mix-blend-screen" />
        <div className="absolute top-[40%] right-[10%] w-[500px] h-[500px] bg-cyan-500/20 rounded-full blur-[150px] mix-blend-screen" />
      </div>

      <div className="flex flex-col items-center pt-32 px-4 text-center relative z-10 min-h-screen">
        
        {/* Hero Section (Scrolls away with 3D effect) */}
        <motion.div
          style={{ 
            y: headerY, 
            opacity: headerOpacity, 
            scale: headerScale,
            rotateX: headerRotateX,
            transformStyle: "preserve-3d"
          }}
          className="flex flex-col items-center"
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0, rotateY: -30 }}
            animate={{ scale: 1, opacity: 1, rotateY: 0 }}
            transition={{ type: "spring", stiffness: 100, damping: 20, duration: 1 }}
          >
            <h1 className="text-6xl md:text-8xl font-black font-playfair tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-emerald-400 via-teal-300 to-cyan-500 mb-6 drop-shadow-2xl" dangerouslySetInnerHTML={{ __html: 'Farm Smarter.<br/>Not Harder.' }}>
            </h1>
          </motion.div>
          
          <motion.p 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="text-xl md:text-2xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto mb-10 font-lora italic leading-relaxed"
          >
            Experience the future of agriculture with an AI-driven engine tailored to your exact soil chemistry, live hyper-local weather, and real-time market economics.
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6, type: "spring", bounce: 0.5 }}
          >
            <Link to={isAuthenticated ? "/dashboard" : "/signup"} className="group relative inline-flex items-center justify-center px-10 py-5 font-bold text-white transition-all duration-300 bg-emerald-600 rounded-full shadow-[0_0_40px_rgba(16,185,129,0.4)] hover:shadow-[0_0_60px_rgba(16,185,129,0.7)] hover:-translate-y-1 overflow-hidden">
              <span className="absolute inset-0 w-full h-full -mt-1 rounded-lg opacity-30 bg-gradient-to-b from-transparent via-transparent to-black"></span>
              <span className="relative text-lg font-poppins flex items-center gap-3">
                {isAuthenticated ? 'Go to Dashboard' : 'Start Predicting Now'}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
              </span>
            </Link>
          </motion.div>
        </motion.div>

        {/* Floating 3D Cards Section (Scrolls in) */}
        <motion.div 
          style={{ y: cardsY }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-40 max-w-6xl w-full pb-32"
        >
          <FeatureCard 
            icon={<Sprout className="w-12 h-12 text-emerald-500" />}
            title="Hybrid ML + AI Engine"
            desc="Mathematical Machine Learning predicts viability, while Gemini LLM designs advanced Intercropping geometries."
          />
          <FeatureCard 
            icon={<Activity className="w-12 h-12 text-cyan-500" />}
            title="Live Weather Sync"
            desc="Automatically syncs 3-year historical climate averages and applies seasonal and irrigation offsets."
          />
          <FeatureCard 
            icon={<DollarSign className="w-12 h-12 text-amber-500" />}
            title="Autonomous Web Scraping"
            desc="Google Search Grounding scrapes the live internet to calculate absolute real-time ROI for 47 Indian crops."
          />
          <FeatureCard 
            icon={<CloudRain className="w-12 h-12 text-blue-500" />}
            title="Live Weather Integration"
            desc="Precise real-time recommendations based on hyper-local weather conditions."
          />
          <FeatureCard 
            icon={<Globe className="w-12 h-12 text-indigo-500" />}
            title="Accessibility & Localization"
            desc="11 regional language translations available and voice input for removing linguistic barriers."
          />
          <FeatureCard 
            icon={<LineChart className="w-12 h-12 text-green-500" />}
            title="Live Market Price Integration"
            desc="Better and precise ROI values and real-time profit analysis."
          />
          <FeatureCard 
            icon={<Scan className="w-12 h-12 text-purple-500" />}
            title="AI Vision & Disease Detection"
            desc="AI Vision-based soil detection and advisory + Crop disease detection system."
          />
          <FeatureCard 
            icon={<FlaskConical className="w-12 h-12 text-yellow-500" />}
            title="Smart Fertilizer Plans"
            desc="All input parameters passed into AI to give enhanced and parameter combination-specific results."
          />
          <FeatureCard 
            icon={<BookOpen className="w-12 h-12 text-orange-500" />}
            title="Extensive Crop Catalog"
            desc="Highly detailed agronomic information and requirements for 47 different crops."
          />
        </motion.div>


      </div>
    </div>
  );
};

const FeatureCard = ({ icon, title, desc, delay }) => (
  <motion.div 
    initial={{ opacity: 0, y: 100, rotateX: 45, scale: 0.8 }}
    whileInView={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
    viewport={{ once: false, margin: "-100px" }}
    transition={{ type: "spring", stiffness: 80, damping: 15, delay }}
    whileHover={{ 
      y: -15, 
      rotateX: 5,
      rotateY: -5,
      scale: 1.05,
      boxShadow: "0 25px 50px -12px rgba(16, 185, 129, 0.25)"
    }}
    style={{ transformStyle: "preserve-3d", perspective: "1000px" }}
    className="glass-panel p-8 flex flex-col items-center text-center cursor-pointer border border-white/20 dark:border-white/10 relative"
  >
    <div 
      style={{ transform: "translateZ(30px)" }}
      className="p-5 bg-gradient-to-br from-slate-100 to-white dark:from-slate-800 dark:to-slate-900 rounded-2xl mb-6 shadow-inner border border-slate-200 dark:border-slate-700"
    >
      {icon}
    </div>
    <h3 
      style={{ transform: "translateZ(20px)" }}
      className="text-2xl font-bold font-playfair text-slate-800 dark:text-white mb-4"
    >
      {title}
    </h3>
    <p 
      style={{ transform: "translateZ(10px)" }}
      className="text-slate-600 dark:text-slate-400 leading-relaxed font-lora"
    >
      {desc}
    </p>
  </motion.div>
);

export default Home;
