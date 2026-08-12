import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sun, Moon, Bell, User as UserIcon, LogOut, MapPin, Loader2, Leaf, Globe } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';

const TopBar = ({ useLiveWeather, toggleLiveWeather, locationName, locLoading, language, languages, onLanguageChange }) => {
  const [showNotifs, setShowNotifs] = useState(false);
    const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <motion.header
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 120, damping: 20 }}
      className="fixed top-3 left-3 md:left-24 right-3 z-40 flex items-center justify-between gap-2
                 bg-white/20 dark:bg-[#1B2A17]/30 backdrop-blur-2xl
                 border border-white/30 dark:border-white/10
                 shadow-[0_8px_40px_rgba(0,0,0,0.15)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.4)]
                 rounded-[1.5rem] px-3 md:px-5 py-2.5 md:py-3"
    >
      {/* Left — Brand + compact controls (flex-1 so it occupies available left space) */}
      <div className="flex items-center gap-2 md:gap-4 flex-1">
        <Link to="/" className="flex items-center gap-2 text-farm-primary dark:text-farm-text-heading font-extrabold font-poppins text-base md:text-lg select-none hover:scale-105 transition-transform cursor-pointer">
          <Leaf className="w-5 h-5 text-farm-primary" />
          <span className="hidden sm:inline">AgriVision</span>
        </Link>

        {/* place compact live location control here on small screens so it uses left area */}
        {useLiveWeather !== undefined && (
          <div className="flex lg:hidden items-center ml-3">
            <button
              onClick={toggleLiveWeather}
              title={useLiveWeather ? `Live: ${locationName || 'Location'}` : 'Enable Live Location'}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all border border-white/20 bg-white/5 dark:bg-white/5 ${useLiveWeather ? 'ring-2 ring-emerald-400' : 'opacity-90'}`}
            >
              <MapPin className={`w-5 h-5 ${useLiveWeather ? 'text-emerald-400' : 'text-slate-300'}`} />
            </button>
          </div>
        )}
      </div>

      {/* Right — Actions */}
      <div className="flex items-center gap-1.5 md:gap-3">
        {/* Location toggle: detailed (desktop) + compact (mobile) variants */}
        {useLiveWeather !== undefined && (
          <>
            {/* Detailed — visible on large screens */}
            <div className="hidden lg:flex items-center gap-3 bg-white/30 dark:bg-white/5 border border-white/30 dark:border-white/10 rounded-2xl px-4 py-1.5 mr-2">
              <MapPin className="w-4 h-4 text-farm-accent-gold flex-shrink-0" />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 leading-none">Live Location</span>
                <AnimatePresence mode="wait">
                  {useLiveWeather && locationName ? (
                    <motion.span
                      key="loc"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="text-xs font-semibold text-slate-800 dark:text-white"
                    >
                      {locationName}
                    </motion.span>
                  ) : locLoading ? (
                    <motion.span key="loading" className="text-xs text-slate-400 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Fetching…
                    </motion.span>
                  ) : (
                    <motion.span key="off" className="text-xs text-slate-400">Off</motion.span>
                  )}
                </AnimatePresence>
              </div>
              {/* Toggle switch */}
              <label className="relative inline-flex items-center cursor-pointer ml-1">
                <input type="checkbox" className="sr-only peer" checked={!!useLiveWeather} onChange={toggleLiveWeather} />
                <div className="w-10 h-5 bg-white/20 peer-focus:outline-none rounded-full peer
                                peer-checked:after:translate-x-full peer-checked:after:border-white
                                after:content-[''] after:absolute after:top-[2px] after:left-[2px]
                                after:bg-white after:border-white after:border after:rounded-full
                                after:h-4 after:w-4 after:transition-all
                                peer-checked:bg-farm-primary dark:peer-checked:bg-farm-accent-gold" />
              </label>
            </div>

            {/* compact variant moved into left brand area so it uses available left space */}
          </>
        )}

        {/* Language Selector */}
        {languages && (
          <div className="flex items-center gap-1 bg-white/30 dark:bg-white/5 border border-white/30 dark:border-white/10 rounded-2xl px-2 md:px-3 py-1.5">
            <Globe className="w-4 h-4 text-farm-accent-gold flex-shrink-0" />
            <select
              value={language}
              onChange={(e) => onLanguageChange(e.target.value)}
              className="bg-transparent text-xs md:text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer max-w-[80px] md:max-w-none"
            >
              {languages.map(lang => (
                <option key={lang.code} value={lang.code} className="bg-white dark:bg-slate-800">{lang.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Theme Toggle */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={toggleTheme}
          className="w-9 h-9 rounded-2xl flex items-center justify-center bg-white/30 dark:bg-white/10 border border-white/30 dark:border-white/10 hover:bg-white/50 dark:hover:bg-white/20 transition-all"
        >
          {theme === 'dark'
            ? <Sun className="w-4 h-4 text-amber-400" />
            : <Moon className="w-4 h-4 text-slate-600" />
          }
        </motion.button>

        {/* Profile */}
        <Link to="/profile">
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="flex items-center gap-2 bg-white/30 dark:bg-white/10 border border-white/30 dark:border-white/10 rounded-2xl px-2 md:px-3 py-1.5 cursor-pointer hover:bg-white/50 dark:hover:bg-white/20 transition-all"
          >
            <div className="w-7 h-7 rounded-full bg-farm-primary flex items-center justify-center">
              <UserIcon className="w-4 h-4 text-white" />
            </div>
            <span className="hidden md:block text-sm font-semibold text-slate-800 dark:text-white max-w-[80px] truncate">
              {user?.name || 'Farmer'}
            </span>
          </motion.div>
        </Link>

        {/* Logout */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleLogout}
          className="w-9 h-9 rounded-2xl flex items-center justify-center bg-red-500/10 border border-red-400/20 hover:bg-red-500/20 text-red-500 transition-all"
          title="Logout"
        >
          <LogOut className="w-4 h-4" />
        </motion.button>
      </div>
    </motion.header>
  );
};

export default TopBar;
