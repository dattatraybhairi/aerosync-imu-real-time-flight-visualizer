import React from 'react';
import { Code } from 'lucide-react';

interface TopNavProps {
  onOpenCodeModal: () => void;
  onNavigateSection: (section: 'fleet' | 'device_imu' | 'serial' | 'calibration') => void;
  activeSection: string;
}

export const TopNav: React.FC<TopNavProps> = ({
  onOpenCodeModal,
  onNavigateSection,
  activeSection,
}) => {
  return (
    <header className="relative z-40 flex items-center justify-between gap-8 px-6 py-3.5 bg-white/95 border-b border-slate-200 shadow-xs select-none">
      {/* Zone 1: Single text element wordmark */}
      <a
        href="#top"
        onClick={(e) => {
          e.preventDefault();
          onNavigateSection('fleet');
        }}
        className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
      >
        AeroSync IMU
      </a>

      {/* Zone 2: 4 concise single-line text navigation links */}
      <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-600">
        <button
          type="button"
          onClick={() => onNavigateSection('fleet')}
          className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeSection === 'fleet' ? 'text-sky-600 underline underline-offset-4 font-bold' : ''
          }`}
        >
          Airbus & Boeing
        </button>
        <button
          type="button"
          onClick={() => onNavigateSection('device_imu')}
          className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeSection === 'device_imu'
              ? 'text-sky-600 underline underline-offset-4 font-bold'
              : ''
          }`}
        >
          Device IMU
        </button>
        <button
          type="button"
          onClick={() => onNavigateSection('serial')}
          className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeSection === 'serial' ? 'text-sky-600 underline underline-offset-4 font-bold' : ''
          }`}
        >
          WebSerial USB
        </button>
        <button
          type="button"
          onClick={() => onNavigateSection('calibration')}
          className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeSection === 'calibration'
              ? 'text-sky-600 underline underline-offset-4 font-bold'
              : ''
          }`}
        >
          Zero Calibration
        </button>
      </nav>

      {/* Zone 3: 1 primary action */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onOpenCodeModal}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Code className="w-3.5 h-3.5 text-sky-400" />
          <span>Hardware & Python Code</span>
        </button>
      </div>
    </header>
  );
};
