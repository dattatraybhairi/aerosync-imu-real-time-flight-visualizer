import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseIMUString,
  applyCalibration,
  normalizeAngle180,
  normalizeHeading360,
  DEFAULT_CALIBRATION,
  generateSimulatedAttitude,
  deviceOrientationToIMU,
  accelerometerToAttitude,
  type CalibrationConfig,
} from './imuMath';

test('normalizeAngle180 clamps within [-180, 180]', () => {
  assert.equal(normalizeAngle180(0), 0);
  assert.equal(normalizeAngle180(190), -170);
  assert.equal(normalizeAngle180(-190), 170);
  assert.equal(normalizeAngle180(360), 0);
});

test('normalizeHeading360 normalizes within [0, 360)', () => {
  assert.equal(normalizeHeading360(0), 0);
  assert.equal(normalizeHeading360(360), 0);
  assert.equal(normalizeHeading360(-30), 330);
  assert.equal(normalizeHeading360(390), 30);
});

test('parseIMUString parses CSV formats correctly', () => {
  const result1 = parseIMUString('15.5, -20.2, 180.0');
  assert.ok(result1);
  assert.equal(result1.pitch, 15.5);
  assert.equal(result1.roll, -20.2);
  assert.equal(result1.yaw, 180.0);

  const result2 = parseIMUString('12.0 45.0 90.0 0.1 0.2 9.8');
  assert.ok(result2);
  assert.equal(result2.pitch, 12.0);
  assert.equal(result2.roll, 45.0);
  assert.equal(result2.yaw, 90.0);
  assert.equal(result2.ax, 0.1);
});

test('parseIMUString parses Key-Value format', () => {
  const result = parseIMUString('Pitch: 22.4, Roll: -11.8, Yaw: 315.0');
  assert.ok(result);
  assert.equal(result.pitch, 22.4);
  assert.equal(result.roll, -11.8);
  assert.equal(result.yaw, 315.0);
});

test('parseIMUString parses JSON format', () => {
  const result = parseIMUString('{"pitch": -5.5, "roll": 12.3, "yaw": 270.0, "ax": 0.05}');
  assert.ok(result);
  assert.equal(result.pitch, -5.5);
  assert.equal(result.roll, 12.3);
  assert.equal(result.yaw, 270.0);
  assert.equal(result.ax, 0.05);
});

test('applyCalibration handles offsets (tare zeroing)', () => {
  const raw = {
    pitch: 10,
    roll: 5,
    yaw: 90,
    timestamp: Date.now(),
  };

  const config: CalibrationConfig = {
    ...DEFAULT_CALIBRATION,
    pitchOffset: 10,
    rollOffset: 5,
    yawOffset: 90,
    smoothingFactor: 0,
  };

  const calibrated = applyCalibration(raw, config);
  assert.equal(calibrated.pitch, 0);
  assert.equal(calibrated.roll, 0);
  assert.equal(calibrated.yaw, 0);
});

test('applyCalibration handles axis inversions', () => {
  const raw = {
    pitch: 15,
    roll: -20,
    yaw: 100,
    timestamp: Date.now(),
  };

  const config: CalibrationConfig = {
    ...DEFAULT_CALIBRATION,
    invertPitch: true,
    invertRoll: true,
    smoothingFactor: 0,
  };

  const calibrated = applyCalibration(raw, config);
  assert.equal(calibrated.pitch, -15);
  assert.equal(calibrated.roll, 20);
});

test('deviceOrientationToIMU maps portrait and landscape phone/tablet/laptop sensors', () => {
  // Portrait (angle = 0): beta=25 -> pitch=25, gamma=-15 -> roll=-15, alpha=90 -> yaw=270
  const portrait = deviceOrientationToIMU(90, 25, -15, 0);
  assert.equal(portrait.pitch, 25);
  assert.equal(portrait.roll, -15);
  assert.equal(portrait.yaw, 270);

  // Landscape primary (angle = 90): pitch = -gamma, roll = beta
  const landscape = deviceOrientationToIMU(0, 20, -10, 90);
  assert.equal(landscape.pitch, 10);
  assert.equal(landscape.roll, 20);
  assert.equal(landscape.yaw, 0);
});

test('accelerometerToAttitude calculates pitch and roll from gravity vector', () => {
  // Flat on table: ax=0, ay=0, az=9.81
  const flat = accelerometerToAttitude(0, 0, 9.81, 45);
  assert.equal(flat.pitch, 0);
  assert.equal(flat.roll, 0);
  assert.equal(flat.yaw, 45);
});

test('generateSimulatedAttitude produces continuous flight values', () => {
  const att1 = generateSimulatedAttitude('climb_dive', 0);
  assert.ok(typeof att1.pitch === 'number');
  assert.ok(typeof att1.roll === 'number');
  assert.ok(typeof att1.yaw === 'number');

  const att2 = generateSimulatedAttitude('barrel_roll', 1.0);
  assert.ok(att2.pitch >= -90 && att2.pitch <= 90);
  assert.ok(att2.roll >= -180 && att2.roll <= 180);
});
