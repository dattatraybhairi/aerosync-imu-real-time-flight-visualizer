import React, { useState } from 'react';
import { X, Copy, Check, Download, Cpu, Terminal, Github, Cable } from 'lucide-react';

interface HardwareCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HardwareCodeModal: React.FC<HardwareCodeModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'mpu6050' | 'bno055' | 'python' | 'wiring' | 'github'>('mpu6050');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const mpu6050Code = `/**
 * ESP32 + MPU6050 Inertial Measurement Unit (IMU) Flight Telemetry Firmware
 * Transmits real-time pitch, roll, yaw, and acceleration over USB Serial at 115200 baud.
 */

#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>

Adafruit_MPU6050 mpu;

float pitch = 0.0;
float roll  = 0.0;
float yaw   = 0.0;

// Calibration zero offsets
float accOffsetX = 0.0, accOffsetY = 0.0, accOffsetZ = 0.0;
float gyroOffsetX = 0.0, gyroOffsetY = 0.0, gyroOffsetZ = 0.0;

unsigned long prevTime = 0;
const int CALIBRATION_SAMPLES = 250;

void calibrateSensors() {
  Serial.println("// Calibrating MPU6050... Keep ESP32 flat and motionless on desk");
  float axSum = 0, aySum = 0, azSum = 0;
  float gxSum = 0, gySum = 0, gzSum = 0;

  for (int i = 0; i < CALIBRATION_SAMPLES; i++) {
    sensors_event_t a, g, temp;
    mpu.getEvent(&a, &g, &temp);

    axSum += a.acceleration.x;
    aySum += a.acceleration.y;
    azSum += a.acceleration.z - 9.81; // 1G gravity compensation

    gxSum += g.gyro.x;
    gySum += g.gyro.y;
    gzSum += g.gyro.z;
    delay(5);
  }

  accOffsetX = axSum / CALIBRATION_SAMPLES;
  accOffsetY = aySum / CALIBRATION_SAMPLES;
  accOffsetZ = azSum / CALIBRATION_SAMPLES;

  gyroOffsetX = gxSum / CALIBRATION_SAMPLES;
  gyroOffsetY = gySum / CALIBRATION_SAMPLES;
  gyroOffsetZ = gzSum / CALIBRATION_SAMPLES;
  Serial.println("// Calibration done. Streaming real-time flight moments...");
}

void setup() {
  Serial.begin(115200);
  while (!Serial) delay(10);

  // Initialize ESP32 I2C: SDA=GPIO21, SCL=GPIO22, 400kHz
  Wire.begin(21, 22, 400000);

  if (!mpu.begin()) {
    Serial.println("// ERROR: Failed to find MPU6050 chip. Check wiring!");
    while (1) delay(500);
  }

  mpu.setAccelerometerRange(MPU6050_RANGE_4_G);
  mpu.setGyroRange(MPU6050_RANGE_500_DEG);
  mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);

  delay(100);
  calibrateSensors();
  prevTime = micros();
}

void loop() {
  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);

  unsigned long currentTime = micros();
  float dt = (currentTime - prevTime) / 1000000.0;
  prevTime = currentTime;
  if (dt <= 0.0 || dt > 0.2) dt = 0.02;

  // Offset correction
  float ax = a.acceleration.x - accOffsetX;
  float ay = a.acceleration.y - accOffsetY;
  float az = a.acceleration.z - accOffsetZ;

  float gx = (g.gyro.x - gyroOffsetX) * 180.0 / PI; // deg/s
  float gy = (g.gyro.y - gyroOffsetY) * 180.0 / PI;
  float gz = (g.gyro.z - gyroOffsetZ) * 180.0 / PI;

  // Accelerometer pitch & roll (degrees)
  float accPitch = atan2(-ax, sqrt(ay * ay + az * az)) * 180.0 / PI;
  float accRoll  = atan2(ay, az) * 180.0 / PI;

  // Complementary Filter (97% Gyro Integration, 3% Accelerometer)
  pitch = 0.97 * (pitch + gy * dt) + 0.03 * accPitch;
  roll  = 0.97 * (roll  + gx * dt) + 0.03 * accRoll;
  yaw   += gz * dt;

  while (yaw >= 360.0) yaw -= 360.0;
  while (yaw < 0.0)    yaw += 360.0;

  // Transmit standard telemetry CSV: pitch,roll,yaw,ax,ay,az
  Serial.printf("%.2f,%.2f,%.2f,%.2f,%.2f,%.2f\\n", pitch, roll, yaw, ax, ay, az);

  delay(20); // ~50 Hz update rate
}
`;

  const bno055Code = `/**
 * ESP32 + Bosch BNO055 Absolute Orientation 9-DOF Sensor Telemetry
 * Built-in sensor fusion coprocessor delivers drift-free Pitch, Roll, and Compass Heading.
 */

#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BNO055.h>
#include <utility/imumaths.h>

Adafruit_BNO055 bno = Adafruit_BNO055(55, 0x28, &Wire);

void setup() {
  Serial.begin(115200);
  while (!Serial) delay(10);

  Wire.begin(21, 22, 400000); // ESP32 SDA=21, SCL=22

  if (!bno.begin()) {
    Serial.println("// ERROR: BNO055 not detected. Check I2C address and wiring!");
    while (1) delay(500);
  }

  delay(200);
  bno.setExtCrystalUse(true);
  Serial.println("// BNO055 streaming 9-DOF fused flight orientation...");
}

void loop() {
  // Read Fused Euler Orientation (degrees)
  imu::Vector<3> euler = bno.getVector(Adafruit_BNO055::VECTOR_EULER);
  imu::Vector<3> acc   = bno.getVector(Adafruit_BNO055::VECTOR_LINEARACCEL);

  float yaw   = euler.x(); // 0 to 360 degrees
  float roll  = euler.y(); // -180 to 180 degrees
  float pitch = euler.z(); // -90 to 90 degrees

  // Transmit standard telemetry sentence: pitch,roll,yaw,ax,ay,az
  Serial.printf("%.2f,%.2f,%.2f,%.2f,%.2f,%.2f\\n", pitch, roll, yaw, acc.x(), acc.y(), acc.z());

  delay(20); // 50 Hz
}
`;

  const pythonCode = `#!/usr/bin/env python3
"""
mac_imu_bridge.py
macOS Python Serial-to-WebSocket Bridge for ESP32 IMU Telemetry

Requirements:
    pip3 install pyserial websockets

Run:
    python3 scripts/mac_imu_bridge.py                               # Auto-detect ESP32 USB port
    python3 scripts/mac_imu_bridge.py --port /dev/cu.usbserial-0001 # Explicit USB port
    python3 scripts/mac_imu_bridge.py --simulate                    # Test WebSocket without ESP32
"""

import argparse
import asyncio
import glob
import math
import time
import serial
import websockets

DEFAULT_BAUD = 115200
DEFAULT_WS_PORT = 8765
connected_clients = set()

def find_esp32_port():
    """Auto-detects USB serial device on macOS."""
    patterns = [
        '/dev/cu.usbserial*',
        '/dev/cu.SLAB_USBtoUART*',
        '/dev/cu.wchusbserial*',
        '/dev/cu.usbmodem*',
        '/dev/tty.usbserial*',
        '/dev/tty.SLAB_USBtoUART*',
        '/dev/tty.wchusbserial*',
    ]
    detected = []
    for pat in patterns:
        detected.extend(glob.glob(pat))
    return detected[0] if detected else None

async def broadcast_serial_imu(ser):
    loop = asyncio.get_running_loop()
    print("Reading ESP32 telemetry...")
    while True:
        try:
            line = await loop.run_in_executor(None, ser.readline)
            decoded = line.decode('utf-8', errors='ignore').strip()
            if decoded and not decoded.startswith('//') and connected_clients:
                await asyncio.gather(
                    *[client.send(decoded) for client in connected_clients],
                    return_exceptions=True
                )
        except Exception as e:
            print(f"Serial read error: {e}")
            await asyncio.sleep(0.1)

async def broadcast_simulated_imu():
    print("Streaming 50Hz SIMULATED IMU telemetry over WebSocket...")
    t0 = time.time()
    while True:
        t = time.time() - t0
        pitch = math.sin(t * 0.9) * 18.0 + math.cos(t * 0.4) * 6.0
        roll = math.cos(t * 0.7) * 32.0 + math.sin(t * 1.3) * 8.0
        yaw = (t * 22.0) % 360.0
        ax = -math.sin(math.radians(pitch)) * 9.81
        ay = math.sin(math.radians(roll)) * math.cos(math.radians(pitch)) * 9.81
        az = math.cos(math.radians(roll)) * math.cos(math.radians(pitch)) * 9.81
        payload = f"{pitch:.2f},{roll:.2f},{yaw:.2f},{ax:.2f},{ay:.2f},{az:.2f}"
        if connected_clients:
            await asyncio.gather(
                *[client.send(payload) for client in connected_clients],
                return_exceptions=True
            )
        await asyncio.sleep(0.02)

async def ws_handler(websocket):
    connected_clients.add(websocket)
    print(f"Browser connected. Active clients: {len(connected_clients)}")
    try:
        await websocket.wait_closed()
    finally:
        connected_clients.discard(websocket)
        print(f"Browser disconnected. Active clients: {len(connected_clients)}")

async def main():
    parser = argparse.ArgumentParser(description="macOS ESP32 IMU WebSocket Bridge")
    parser.add_argument("positional_port", nargs="?", default=None)
    parser.add_argument("--port", "-p", default=None)
    parser.add_argument("--baud", "-b", type=int, default=DEFAULT_BAUD)
    parser.add_argument("--ws-port", type=int, default=DEFAULT_WS_PORT)
    parser.add_argument("--simulate", "-s", action="store_true")
    args = parser.parse_args()

    server = await websockets.serve(ws_handler, "localhost", args.ws_port)
    print(f"WebSocket Server running at ws://localhost:{args.ws_port}")

    if args.simulate:
        await broadcast_simulated_imu()
        return

    port = args.port or args.positional_port or find_esp32_port()
    if not port:
        print("No ESP32 detected on USB. Falling back to --simulate mode...")
        await broadcast_simulated_imu()
        return

    print(f"Connecting to ESP32 on port: {port} at {args.baud} baud...")
    try:
        ser = serial.Serial(port, args.baud, timeout=1)
    except Exception as e:
        print(f"Error opening port {port}: {e}")
        return

    await broadcast_serial_imu(ser)

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\\nBridge stopped.")
`;

  const wiringGuide = `===============================================================
ESP32 TO IMU HARDWARE WIRING GUIDE
===============================================================

1. ESP32 to MPU-6050 (or BNO055) Pinout:
   ------------------------------------------------------------
   ESP32 DevKit Board           IMU Sensor Module (MPU6050/BNO)
   ------------------------------------------------------------
   3V3 (3.3V Power)      -----> VCC / VIN  (Do NOT use 5V!)
   GND (Ground)          -----> GND
   GPIO 21 (SDA)         -----> SDA (Serial Data)
   GPIO 22 (SCL)         -----> SCL (Serial Clock)
   GND                   -----> AD0 (Sets I2C address to 0x68)
   ------------------------------------------------------------

2. Hardware Tips:
   - Wire length: Keep I2C jumper wires under 20cm (8 inches) for 400kHz stability.
   - Decoupling: Standard breakout boards (like GY-521) already have pull-up resistors on SDA/SCL.
   - Orientation: Align the sensor's X axis along the model aircraft's fuselage (forward),
     and Y axis along the wings (right).
   - If mounted sideways or upside down, use the "IMU Axis Calibration" tab on the dashboard
     to click "Zero / Tare Level" or toggle Axis Inversion!

3. Mac Connection Options:
   Option A (No Python required):
     - Plug ESP32 into Mac via USB cable.
     - Open Chrome or Edge.
     - Click "WebSerial (ESP32)" on the dashboard, select your ESP32 device, and click Connect!
   Option B (Python WebSocket Server):
     - Run: pip3 install pyserial websockets
     - Run: python3 scripts/mac_imu_bridge.py
     - Dashboard connects automatically over ws://localhost:8765.
`;

  const githubWorkflowCode = `# .github/workflows/deploy.yml
name: Deploy AeroSync to GitHub Pages

on:
  push:
    branches: ["main"]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Install dependencies
        run: npm install --legacy-peer-deps

      - name: Build static Vite application
        run: npm run build

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: './dist'

  deploy:
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
`;

  const currentCode =
    activeTab === 'mpu6050'
      ? mpu6050Code
      : activeTab === 'bno055'
      ? bno055Code
      : activeTab === 'python'
      ? pythonCode
      : activeTab === 'wiring'
      ? wiringGuide
      : githubWorkflowCode;

  const currentFilename =
    activeTab === 'mpu6050'
      ? 'esp32_mpu6050_telemetry.ino'
      : activeTab === 'bno055'
      ? 'esp32_bno055_telemetry.ino'
      : activeTab === 'python'
      ? 'mac_imu_bridge.py'
      : activeTab === 'wiring'
      ? 'esp32_imu_wiring.txt'
      : 'deploy.yml';

  const handleCopy = () => {
    navigator.clipboard.writeText(currentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([currentCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = currentFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-950 flex items-center justify-center text-sky-700 dark:text-sky-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                ESP32 Firmware, Python Bridge & GitHub Pages
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Complete tested Arduino C++ code, macOS Python WebSocket server, and GitHub Pages CI/CD workflow
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Strip */}
        <div className="flex flex-wrap items-center justify-between px-6 py-2.5 bg-slate-100/90 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 text-xs gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('mpu6050')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                activeTab === 'mpu6050'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Cpu className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span>ESP32 MPU-6050</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('bno055')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                activeTab === 'bno055'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Cpu className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>ESP32 BNO-055</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('python')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                activeTab === 'python'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Terminal className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Mac Python Bridge</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('wiring')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                activeTab === 'wiring'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Cable className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Wiring & Pins</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('github')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                activeTab === 'github'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Github className="w-3.5 h-3.5 text-slate-800 dark:text-slate-200" />
              <span>GitHub Pages</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors font-medium cursor-pointer"
              title={`Download ${currentFilename}`}
            >
              <Download className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span>Download</span>
            </button>

            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors font-medium cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              <span>{copied ? 'Copied!' : 'Copy Code'}</span>
            </button>
          </div>
        </div>

        {/* Code Content */}
        <div className="flex-1 p-6 overflow-y-auto bg-slate-950 font-mono text-xs text-slate-200">
          <pre className="whitespace-pre overflow-x-auto leading-relaxed">
            {currentCode}
          </pre>
        </div>

        {/* Footer Notes */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex items-center justify-between">
          <span>
            {activeTab === 'mpu6050' && 'Flash using Arduino IDE. Streams CSV "pitch,roll,yaw,ax,ay,az" at 50Hz over USB serial.'}
            {activeTab === 'bno055' && 'Hardware 9-DOF fusion with zero gyro drift. Output format is 100% compatible.'}
            {activeTab === 'python' && 'Reads serial on macOS and broadcasts via WebSockets on ws://localhost:8765.'}
            {activeTab === 'wiring' && 'Connect 3.3V to VCC (not 5V), GND to GND, GPIO21 to SDA, GPIO22 to SCL.'}
            {activeTab === 'github' && 'In GitHub Repo Settings → Pages → Source, select "GitHub Actions" to allow automated deployment!'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
