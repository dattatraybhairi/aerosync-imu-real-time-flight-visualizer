import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TopNav } from './components/TopNav';
import {
  AeroViewport,
  type AircraftType,
  type CameraPreset,
} from './components/AeroViewport';
import { AIRCRAFT_CATALOG } from './three/aircraftModels';
import { PrimaryFlightDisplay } from './components/PrimaryFlightDisplay';
import { TelemetryScope } from './components/TelemetryScope';
import { ControlDock } from './components/ControlDock';
import { HardwareCodeModal } from './components/HardwareCodeModal';
import {
  type IMUData,
  type CalibrationConfig,
  DEFAULT_CALIBRATION,
  applyCalibration,
} from './utils/imuMath';
import { type DataSourceType } from './components/ConnectionManager';
import { ChevronRight, ChevronLeft, Activity, Gauge } from 'lucide-react';

export default function App() {
  // IMU Data states
  const [rawIMU, setRawIMU] = useState<IMUData>({
    pitch: 0,
    roll: 0,
    yaw: 0,
    timestamp: Date.now(),
  });

  const [calibrationConfig, setCalibrationConfig] =
    useState<CalibrationConfig>(DEFAULT_CALIBRATION);

  const prevCalibratedRef = useRef<IMUData>({
    pitch: 0,
    roll: 0,
    yaw: 0,
    timestamp: Date.now(),
  });

  const [calibratedIMU, setCalibratedIMU] = useState<IMUData>(prevCalibratedRef.current);

  // Connection & Simulation states
  const [currentSource, setCurrentSource] = useState<DataSourceType>('simulation');
  const [isSimulating, setIsSimulating] = useState<boolean>(true);

  // Single Active Aircraft & Camera states
  const [selectedAircraft, setSelectedAircraft] = useState<AircraftType>('airbus_a350');
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('isometric');
  const [showAxes, setShowAxes] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(true);

  // HUD & Dock states
  const [hudView, setHudView] = useState<'pfd' | 'scope' | 'both'>('pfd');
  const [hudCollapsed, setHudCollapsed] = useState<boolean>(false);
  const [codeModalOpen, setCodeModalOpen] = useState<boolean>(false);
  const [activeSection, setActiveSection] = useState<string>('fleet');
  const [dockTab, setDockTab] = useState<'aircraft' | 'connection' | 'calibration'>('aircraft');

  // Packet Rate Counter (Hz)
  const [packetRate, setPacketRate] = useState<number>(40);
  const packetCountRef = useRef<number>(0);

  const handleReceiveRawData = useCallback(
    (data: IMUData) => {
      packetCountRef.current += 1;
      setRawIMU(data);
      const calibrated = applyCalibration(data, calibrationConfig, prevCalibratedRef.current);
      prevCalibratedRef.current = calibrated;
      setCalibratedIMU(calibrated);
    },
    [calibrationConfig]
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setPacketRate(packetCountRef.current);
      packetCountRef.current = 0;
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleNavigateSection = (
    section: 'fleet' | 'device_imu' | 'serial' | 'calibration'
  ) => {
    setActiveSection(section);
    if (section === 'fleet') {
      setDockTab('aircraft');
    } else if (section === 'device_imu') {
      setCurrentSource('device_imu');
      setDockTab('connection');
    } else if (section === 'serial') {
      setCurrentSource('webserial');
      setDockTab('connection');
    } else if (section === 'calibration') {
      setDockTab('calibration');
    }
  };

  const activeMeta =
    AIRCRAFT_CATALOG.find((a) => a.id === selectedAircraft) || AIRCRAFT_CATALOG[0];

  const sourceLabel =
    currentSource === 'device_imu'
      ? 'LOCAL DEVICE IMU'
      : currentSource === 'webserial'
      ? 'WEBSERIAL ESP32'
      : currentSource === 'websocket'
      ? 'WEBSOCKET PYTHON'
      : 'FLIGHT SIMULATION';

  return (
    <div className="relative w-screen h-screen flex flex-col bg-slate-50 text-slate-800 overflow-hidden font-sans">
      {/* 1. Top Navigation Bar */}
      <TopNav
        onOpenCodeModal={() => setCodeModalOpen(true)}
        onNavigateSection={handleNavigateSection}
        activeSection={activeSection}
      />

      {/* 2. Main 3D Single-Aircraft Viewport Layer */}
      <main className="relative flex-1 w-full h-full overflow-hidden">
        <AeroViewport
          imuData={calibratedIMU}
          selectedAircraft={selectedAircraft}
          cameraPreset={cameraPreset}
          showAxes={showAxes}
          showGrid={showGrid}
        />

        {/* 3. Floating Left Instrument HUD */}
        <div
          className={`absolute top-4 left-4 z-20 flex flex-col gap-2 transition-all duration-300 pointer-events-auto ${
            hudCollapsed ? '-translate-x-[calc(100%-28px)]' : 'translate-x-0'
          }`}
        >
          <div className="relative flex items-start gap-1">
            <div className="flex flex-col gap-2 max-w-[260px]">
              {/* HUD Mode Switcher */}
              <div className="flex items-center gap-1 p-0.5 bg-white/95 border border-slate-200/90 rounded-lg shadow-xs text-[11px] font-semibold text-slate-600">
                <button
                  type="button"
                  onClick={() => setHudView('pfd')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    hudView === 'pfd'
                      ? 'bg-slate-900 text-white font-bold'
                      : 'hover:text-slate-900'
                  }`}
                >
                  <Gauge className="w-3 h-3 text-sky-400" />
                  <span>Attitude PFD</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHudView('scope')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    hudView === 'scope'
                      ? 'bg-slate-900 text-white font-bold'
                      : 'hover:text-slate-900'
                  }`}
                >
                  <Activity className="w-3 h-3 text-emerald-400" />
                  <span>Scope</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHudView('both')}
                  className={`px-2 py-1 rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    hudView === 'both'
                      ? 'bg-slate-900 text-white font-bold'
                      : 'hover:text-slate-900'
                  }`}
                >
                  Both
                </button>
              </div>

              {/* Primary Flight Display */}
              {(hudView === 'pfd' || hudView === 'both') && (
                <PrimaryFlightDisplay imuData={calibratedIMU} />
              )}

              {/* Telemetry Scope */}
              {(hudView === 'scope' || hudView === 'both') && (
                <TelemetryScope imuData={calibratedIMU} packetRate={packetRate} />
              )}
            </div>

            {/* Minimize / Expand Toggle */}
            <button
              type="button"
              onClick={() => setHudCollapsed(!hudCollapsed)}
              aria-label={
                hudCollapsed
                  ? 'Show Flight Instruments HUD'
                  : 'Collapse Flight Instruments HUD'
              }
              className="mt-1 p-1 bg-white border border-slate-300 rounded-r-lg shadow-sm text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              title={
                hudCollapsed
                  ? 'Show Flight Instruments HUD'
                  : 'Collapse Flight Instruments HUD'
              }
            >
              {hudCollapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* 4. Top-Right Active Aircraft & Telemetry Spec Readout */}
        <div className="absolute top-4 right-4 z-20 hidden sm:flex flex-col items-end gap-1.5 pointer-events-none select-none">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white/95 border border-slate-200/90 rounded-lg shadow-xs text-xs font-mono text-slate-700">
            <span className="font-bold text-slate-900">{activeMeta.name}</span>
            <span className="text-slate-300">·</span>
            <span>{activeMeta.code}</span>
            <span className="text-slate-300">·</span>
            <span className="text-sky-600 font-bold">{sourceLabel}</span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-600 bg-white/90 px-2.5 py-1 rounded border border-slate-200/80 font-mono tabular-nums">
            <span>Pitch: {calibratedIMU.pitch >= 0 ? `+${calibratedIMU.pitch.toFixed(1)}` : calibratedIMU.pitch.toFixed(1)}°</span>
            <span>·</span>
            <span>Roll: {calibratedIMU.roll >= 0 ? `+${calibratedIMU.roll.toFixed(1)}` : calibratedIMU.roll.toFixed(1)}°</span>
            <span>·</span>
            <span>Yaw: {Math.round(calibratedIMU.yaw).toString().padStart(3, '0')}°</span>
          </div>
        </div>

        {/* 5. Collapsible Bottom Control Dock */}
        <ControlDock
          selectedAircraft={selectedAircraft}
          setSelectedAircraft={setSelectedAircraft}
          cameraPreset={cameraPreset}
          setCameraPreset={setCameraPreset}
          showAxes={showAxes}
          setShowAxes={setShowAxes}
          showGrid={showGrid}
          setShowGrid={setShowGrid}
          currentSource={currentSource}
          setCurrentSource={setCurrentSource}
          onReceiveRawData={handleReceiveRawData}
          isSimulating={isSimulating}
          setIsSimulating={setIsSimulating}
          calibrationConfig={calibrationConfig}
          setCalibrationConfig={setCalibrationConfig}
          rawIMU={rawIMU}
          activeTab={dockTab}
          setActiveTab={setDockTab}
        />
      </main>

      {/* 6. Hardware Firmware & Python Bridge Code Modal */}
      <HardwareCodeModal
        isOpen={codeModalOpen}
        onClose={() => setCodeModalOpen(false)}
      />
    </div>
  );
}
