/**
 * ESP32 + Bosch BNO055 Absolute Orientation 9-DOF Sensor Telemetry
 * 
 * The BNO055 features an onboard ARM processor with Bosch Sensortec fusion
 * providing drift-free absolute Pitch, Roll, and Yaw (Compass Heading).
 * 
 * Hardware Wiring:
 *   ESP32 Pin      BNO055 Pin
 *   -------------------------
 *   3V3     -----> VIN
 *   GND     -----> GND
 *   GPIO 21 -----> SDA
 *   GPIO 22 -----> SCL
 * 
 * Required Arduino Libraries:
 *   - Adafruit BNO055 (by Adafruit)
 *   - Adafruit Unified Sensor (by Adafruit)
 * 
 * Serial Output Format:
 *   Standard CSV: pitch,roll,yaw,ax,ay,az
 *   Baud Rate: 115200
 */

#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BNO055.h>
#include <utility/imumaths.h>

Adafruit_BNO055 bno = Adafruit_BNO055(55, 0x28, &Wire);

void setup() {
  Serial.begin(115200);
  while (!Serial) delay(10);

  Wire.begin(21, 22, 400000); // 400kHz I2C

  if (!bno.begin()) {
    Serial.println("// ERROR: BNO055 sensor not detected. Check I2C address (0x28 or 0x29) and wiring!");
    while (1) delay(500);
  }

  delay(200);
  bno.setExtCrystalUse(true);
  Serial.println("// BNO055 Initialized. Streaming 9-DOF fused flight orientation...");
}

void loop() {
  // Read Fused Euler Orientation (degrees)
  // bno.getVector returns:
  // x = Heading / Yaw (0 to 360)
  // y = Roll (-180 to 180)
  // z = Pitch (-90 to 90)
  imu::Vector<3> euler = bno.getVector(Adafruit_BNO055::VECTOR_EULER);

  // Read Linear Acceleration (m/s^2 without gravity)
  imu::Vector<3> linearAcc = bno.getVector(Adafruit_BNO055::VECTOR_LINEARACCEL);

  float yaw   = euler.x();
  float roll  = euler.y();
  float pitch = euler.z();

  float ax = linearAcc.x();
  float ay = linearAcc.y();
  float az = linearAcc.z();

  // Transmit standard telemetry sentence: pitch,roll,yaw,ax,ay,az
  Serial.printf("%.2f,%.2f,%.2f,%.2f,%.2f,%.2f\n", pitch, roll, yaw, ax, ay, az);

  delay(20); // ~50Hz stream rate
}
