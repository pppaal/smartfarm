/*
  스마트팜 ESP32 펌웨어 (딸기하우스용)
  ------------------------------------------------------
  부품 (예시):
    - ESP32 DevKit (WROOM-32)
    - DHT22 (온/습도)   → GPIO 4
    - 정전식 토양수분 센서 → GPIO 34 (ADC)
    - MH-Z19B CO2 센서  → UART2 (RX=16, TX=17)
    - BH1750 조도 센서  → I2C (SDA=21, SCL=22)
    - 릴레이 모듈 (관수/환기) → GPIO 25, 26
  ------------------------------------------------------
  라이브러리 (Arduino IDE → 라이브러리 매니저):
    - DHT sensor library (Adafruit)
    - BH1750 (Christopher Laws)
    - ArduinoJson (Benoit Blanchon)
    - MH-Z19 (Jonathan Dempsey)
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <DHT.h>
#include <BH1750.h>
#include <MHZ19.h>
#include <ArduinoJson.h>

// ===== 사용자 설정 =====
const char* WIFI_SSID   = "YOUR_WIFI";
const char* WIFI_PASS   = "YOUR_PASS";
const char* API_URL     = "http://192.168.0.10:4000/api/readings/ingest";
const char* DEVICE_KEY  = "demo-device-key-0001";
const unsigned long INTERVAL_MS = 10000;

// ===== 핀 설정 =====
#define DHT_PIN        4
#define DHT_TYPE       DHT22
#define SOIL_PIN       34
#define CO2_RX         16
#define CO2_TX         17
#define VALVE_IRRIG    25
#define VALVE_VENT     26

DHT dht(DHT_PIN, DHT_TYPE);
BH1750 lightMeter;
MHZ19 mhz19;
HardwareSerial co2Serial(2);

unsigned long lastSend = 0;

// 제어 명령 (서버 응답에서 actuate 힌트 반영)
void applyActuation(const String& action, int durationSec) {
  int pin = -1;
  if (action == "irrigate") pin = VALVE_IRRIG;
  else if (action == "vent") pin = VALVE_VENT;
  if (pin < 0) return;
  Serial.printf("[actuate] %s for %ds\n", action.c_str(), durationSec);
  digitalWrite(pin, HIGH);
  delay(durationSec * 1000UL);
  digitalWrite(pin, LOW);
}

float readSoilMoisturePct() {
  // 정전식 센서: 건조 ~3000, 포화 ~1200 (센서별 캘리브 필요)
  int raw = analogRead(SOIL_PIN);
  float pct = map(raw, 3000, 1200, 0, 100);
  if (pct < 0) pct = 0;
  if (pct > 100) pct = 100;
  return pct;
}

void setup() {
  Serial.begin(115200);
  delay(500);
  pinMode(VALVE_IRRIG, OUTPUT);
  pinMode(VALVE_VENT, OUTPUT);
  digitalWrite(VALVE_IRRIG, LOW);
  digitalWrite(VALVE_VENT, LOW);

  Wire.begin();
  lightMeter.begin();
  dht.begin();
  co2Serial.begin(9600, SERIAL_8N1, CO2_RX, CO2_TX);
  mhz19.begin(co2Serial);
  mhz19.autoCalibration();

  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("[wifi] connecting");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500); Serial.print(".");
  }
  Serial.printf("\n[wifi] connected: %s\n", WiFi.localIP().toString().c_str());
}

void loop() {
  if (millis() - lastSend < INTERVAL_MS) {
    delay(50);
    return;
  }
  lastSend = millis();

  float t = dht.readTemperature();
  float h = dht.readHumidity();
  float soil = readSoilMoisturePct();
  int co2 = mhz19.getCO2();
  float lux = lightMeter.readLightLevel();

  if (isnan(t) || isnan(h)) {
    Serial.println("[err] DHT read failed");
    return;
  }

  StaticJsonDocument<256> doc;
  doc["device_key"]    = DEVICE_KEY;
  doc["temperature"]   = t;
  doc["humidity"]      = h;
  doc["soil_moisture"] = soil;
  doc["co2"]           = co2;
  doc["light"]         = lux;

  String body;
  serializeJson(doc, body);

  HTTPClient http;
  http.begin(API_URL);
  http.addHeader("Content-Type", "application/json");
  int status = http.POST(body);
  Serial.printf("[send] %d %s\n", status, body.c_str());

  if (status == 200) {
    String resp = http.getString();
    StaticJsonDocument<512> r;
    if (deserializeJson(r, resp) == DeserializationError::Ok) {
      JsonArray fired = r["fired"].as<JsonArray>();
      for (JsonObject a : fired) {
        applyActuation(String((const char*)a["action"]), a["duration_sec"] | 60);
      }
    }
  }
  http.end();
}
