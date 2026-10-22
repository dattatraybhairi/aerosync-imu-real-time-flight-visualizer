/**
 * ESP32 + MPU6050 Inertial Measurement Unit (IMU) Flight Telemetry Firmware
 * 
 * Hardware Wiring:
 *   ESP32 Pin      MPU-6050 Pin
 *   ---------------------------
 *   3V3     -----> VCC
 *   GND     -----> GND
 *   GPIO 21 -----> SDA
 *   GPIO 22 -----> SCL
 * 
 * Required Arduino Libraries:
 *   - Adafruit MPU6050 (by Adafruit)
 *   - Adafruit Unified Sensor (by Adafruit)
 *   - Wire (Built-in)
 * 
 * Serial Output Format:
 *   Standard CSV: pitch,roll,yaw,ax,ay,az
 *   Baud Rate: 115200
 */

#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>

Adafruit_MPU6050 mpu;

// Telemetry State
float pitch = 0.0;
float roll  = 0.0;
float yaw   = 0.0;

// Accelerometer calibration offsets (zero level)
float accOffsetX = 0.0;
float accOffsetY = 0.0;
float accOffsetZ = 0.0;

// Gyroscope calibration offsets (drift compensation)
float gyroOffsetX = 0.0;
float gyroOffsetY = 0.0;
float gyroOffsetZ = 0.0;

unsigned long prevTime = 0;
const int CALIBRATION_SAMPLES = 300;

void calibrateSensors() {
  Serial.println("// Calibrating MPU6050... Keep ESP32 flat and still on table");
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

  Serial.println("// Calibration complete. Starting real-time flight telemetry...");
}

void setup() {
  Serial.begin(115200);
  while (!Serial) {
    delay(10);
  }

  // Initialize I2C bus on ESP32 default pins: SDA=21, SCL=22, 400kHz Fast Mode
  Wire.begin(21, 22, 400000);

  if (!mpu.begin()) {
    Serial.println("// ERROR: Failed to find MPU6050 chip. Check wiring!");
    while (1) {
      delay(500);
    }
  }

  // Configure Sensor Ranges for Flight Dynamics
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

  if (dt <= 0.0 || dt > 0.2) dt = 0.02; // Safeguard against timer wrap

  // Apply calibration offsets
  float ax = a.acceleration.x - accOffsetX;
  float ay = a.acceleration.y - accOffsetY;
  float az = a.acceleration.z - accOffsetZ;

  float gx = (g.gyro.x - gyroOffsetX) * 180.0 / PI; // convert rad/s to deg/s
  float gy = (g.gyro.y - gyroOffsetY) * 180.0 / PI;
  float gz = (g.gyro.z - gyroOffsetZ) * 180.0 / PI;

  // Calculate accelerometer pitch and roll (degrees)
  float accPitch = atan2(-ax, sqrt(ay * ay + az * az)) * 180.0 / PI;
  float accRoll  = atan2(ay, az) * 180.0 / PI;

  // High-performance Complementary Filter (97% Gyro Integration, 3% Accelerometer)
  pitch = 0.97 * (pitch + gy * dt) + 0.03 * accPitch;
  roll  = 0.97 * (roll  + gx * dt) + 0.03 * accRoll;
  yaw   += gz * dt; // Gyro yaw integration

  // Normalize yaw to [0, 360)
  while (yaw >= 360.0) yaw -= 360.0;
  while (yaw < 0.0)    yaw += 360.0;

  // Output standard CSV sentence: pitch,roll,yaw,ax,ay,az
  // Example: "12.45,-4.20,180.50,0.12,-0.05,9.82"
  Serial.printf("%.2f,%.2f,%.2f,%.2f,%.2f,%.2f\n", pitch, roll, yaw, ax, ay, az);

  // ~50 Hz update rate (20ms delay)
  delay(20);
}
