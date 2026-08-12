import React from 'react';
import { NavLink } from 'react-router-dom';
import { Leaf, LayoutDashboard, History, BookOpen, Settings, TrendingUp, Sprout, Beaker, Stethoscope, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';

const Sidebar = () => {
  
  const navItems = [
    { to: '/dashboard', icon: <LayoutDashboard className="w-5 h-5" />, label: 'Dashboard' },
    { to: '/market',    icon: <TrendingUp className="w-5 h-5" />,      label: 'Live Market' },
    { to: '/catalog',   icon: <BookOpen className="w-5 h-5" />,        label: 'Crop Catalog' },
    { to: '/soil',      icon: <Beaker className="w-5 h-5" />,          label: 'Soil Scan' },
    { to: '/disease-detection', icon: <Stethoscope className="w-5 h-5" />, label: 'Disease Detection' },
    { to: '/fertilizer',icon: <ShieldCheck className="w-5 h-5" />,     label: 'Fertilizer' },
    { to: '/history',   icon: <History className="w-5 h-5" />,         label: 'History' },
    { to: '/settings',  icon: <Settings className="w-5 h-5" />,        label: 'Settings' },
  ];

  return (
    <>
      {/* Desktop Sidebar — hidden on mobile */}
      <motion.aside
        initial={{ x: -80, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        className="hidden md:flex fixed left-3 top-1/2 -translate-y-1/2 z-50 flex-col items-center gap-3
                   bg-white/20 dark:bg-[#1B2A17]/30 backdrop-blur-2xl
                   border border-white/30 dark:border-white/10
                   shadow-[0_8px_40px_rgba(0,0,0,0.18)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.5)]
                   rounded-[2rem] p-3 w-16"
      >
        {/* Nav Items */}
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            title={item.label}
            className={({ isActive }) =>
              `relative group flex items-center justify-center w-10 h-10 rounded-2xl transition-all duration-200
              ${isActive
                ? 'bg-farm-primary text-white shadow-[0_4px_14px_rgba(47,75,38,0.4)]'
                : 'text-slate-600 dark:text-slate-300 hover:bg-white/40 dark:hover:bg-white/10'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.div
                    layoutId="sidebar-pill"
                    className="absolute inset-0 rounded-2xl bg-farm-primary"
                    style={{ zIndex: -1 }}
                  />
                )}
                {item.icon}
                {/* Tooltip */}
                <span className="pointer-events-none absolute left-14 bg-slate-900/90 dark:bg-slate-700/90 text-white text-xs font-semibold px-2.5 py-1.5 rounded-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}

        {/* Spacer */}
        <div className="flex-1 min-h-[20px]" />
      </motion.aside>

      {/* Mobile Bottom Nav — visible on mobile only */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50
                      bg-white/30 dark:bg-[#1B2A17]/50 backdrop-blur-2xl
                      border-t border-white/30 dark:border-white/10
                      shadow-[0_-4px_20px_rgba(0,0,0,0.1)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.4)]
                      flex items-center justify-around py-2 px-1 safe-bottom">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all text-[10px] font-semibold
              ${isActive
                ? 'text-farm-primary dark:text-farm-accent-gold'
                : 'text-slate-500 dark:text-slate-400'
              }`
            }
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
};

export default Sidebar;
