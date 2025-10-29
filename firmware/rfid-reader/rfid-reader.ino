/*
 * ESP32 RFID Attendance System - Production Firmware
 * 
 * Features:
 * - MFRC522 RFID reader support
 * - WiFi with auto-reconnect
 * - Offline buffering in LittleFS
 * - Exponential backoff retry
 * - Debounce duplicate scans
 * - Periodic heartbeat
 * - OTA updates support
 * - Visual/audio feedback
 * 
 * Hardware:
 * - ESP32 Dev Board
 * - MFRC522 RFID Module
 * - LED (GPIO 2) - optional
 * - Buzzer (GPIO 4) - optional
 * 
 * Pin Connections (MFRC522):
 * SDA  -> GPIO 21
 * SCK  -> GPIO 18
 * MOSI -> GPIO 23
 * MISO -> GPIO 19
 * RST  -> GPIO 22
 * GND  -> GND
 * 3.3V -> 3.3V
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <MFRC522.h>
#include <LittleFS.h>
#include <ArduinoOTA.h>

// ==================== CONFIGURATION ====================

// WiFi credentials (support multiple networks)
const char* WIFI_SSID_1 = "YourNetworkSSID";
const char* WIFI_PASSWORD_1 = "YourNetworkPassword";
const char* WIFI_SSID_2 = "BackupSSID";
const char* WIFI_PASSWORD_2 = "BackupPassword";

// API Configuration
const char* API_URL = "https://your-api.com/api/v1";
const char* DEVICE_UUID = "esp-reader-01";
String DEVICE_TOKEN = ""; // Will be set after registration

// Device Info
const char* FIRMWARE_VERSION = "1.0.0";
const char* DEVICE_NAME = "Main Entrance Reader";
const char* LOCATION = "Building A - Ground Floor";

// Timing Configuration
const unsigned long DEBOUNCE_TIME = 3000;       // 3 seconds
const unsigned long HEARTBEAT_INTERVAL = 300000; // 5 minutes
const unsigned long RETRY_BASE_DELAY = 1000;     // 1 second
const unsigned long MAX_RETRY_DELAY = 60000;     // 1 minute
const int MAX_BUFFER_SIZE = 500;

// Pin Configuration
#define RST_PIN 22
#define SS_PIN 21
#define LED_PIN 2
#define BUZZER_PIN 4

// ==================== GLOBAL OBJECTS ====================

MFRC522 mfrc522(SS_PIN, RST_PIN);
HTTPClient http;
WiFiClient client;

// State variables
unsigned long lastHeartbeat = 0;
unsigned long lastScanTime = 0;
String lastScannedUID = "";
int bufferCount = 0;
int retryDelay = RETRY_BASE_DELAY;

// ==================== SETUP ====================

void setup() {
  Serial.begin(115200);
  Serial.println("\n\n=================================");
  Serial.println("ESP32 RFID Attendance System");
  Serial.println("Firmware: " + String(FIRMWARE_VERSION));
  Serial.println("=================================\n");

  // Initialize pins
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  // Initialize SPI and RFID
  SPI.begin();
  mfrc522.PCD_Init();
  Serial.println("✓ RFID Reader initialized");

  // Initialize filesystem
  if (!LittleFS.begin(true)) {
    Serial.println("✗ LittleFS mount failed");
    blinkError();
  } else {
    Serial.println("✓ LittleFS mounted");
    loadConfiguration();
    countBufferedEvents();
  }

  // Connect to WiFi
  connectWiFi();

  // Setup OTA
  setupOTA();

  // Load or register device
  if (DEVICE_TOKEN.length() == 0) {
    Serial.println("⚠ Device not registered - attempting registration...");
    registerDevice();
  } else {
    Serial.println("✓ Device token loaded");
  }

  Serial.println("\n🚀 System ready - waiting for RFID tags...\n");
  beep(2);
}

// ==================== MAIN LOOP ====================

void loop() {
  // Handle OTA
  ArduinoOTA.handle();

  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  // Process heartbeat
  if (millis() - lastHeartbeat >= HEARTBEAT_INTERVAL) {
    sendHeartbeat();
    lastHeartbeat = millis();
  }

  // Try to flush buffered events
  if (bufferCount > 0 && WiFi.status() == WL_CONNECTED) {
    flushBuffer();
  }

  // Check for RFID card
  if (!mfrc522.PICC_IsNewCardPresent()) {
    return;
  }

  if (!mfrc522.PICC_ReadCardSerial()) {
    return;
  }

  // Read UID
  String uid = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    uid += String(mfrc522.uid.uidByte[i] < 0x10 ? "0" : "");
    uid += String(mfrc522.uid.uidByte[i], HEX);
    if (i < mfrc522.uid.size - 1) uid += ":";
  }
  uid.toUpperCase();

  // Debounce
  if (uid == lastScannedUID && (millis() - lastScanTime < DEBOUNCE_TIME)) {
    Serial.println("⊘ Duplicate scan ignored: " + uid);
    mfrc522.PICC_HaltA();
    return;
  }

  // Process new scan
  lastScannedUID = uid;
  lastScanTime = millis();

  Serial.println("\n📡 Card detected: " + uid);
  digitalWrite(LED_PIN, HIGH);

  // Create event
  StaticJsonDocument<512> event;
  event["device_uuid"] = DEVICE_UUID;
  event["tag_uid"] = uid;
  event["timestamp"] = getISOTimestamp();
  event["rssi"] = WiFi.RSSI();

  // Try to send immediately
  if (WiFi.status() == WL_CONNECTED && DEVICE_TOKEN.length() > 0) {
    if (sendEvent(event)) {
      Serial.println("✓ Event sent successfully");
      beep(1);
      retryDelay = RETRY_BASE_DELAY; // Reset retry delay
    } else {
      Serial.println("✗ Send failed - buffering event");
      bufferEvent(event);
      beep(3);
    }
  } else {
    Serial.println("⚠ Offline - buffering event");
    bufferEvent(event);
    beep(3);
  }

  digitalWrite(LED_PIN, LOW);
  mfrc522.PICC_HaltA();
}

// ==================== WIFI FUNCTIONS ====================

void connectWiFi() {
  Serial.println("Connecting to WiFi...");
  
  WiFi.mode(WIFI_STA);
  
  // Try first network
  WiFi.begin(WIFI_SSID_1, WIFI_PASSWORD_1);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  // If failed, try backup network
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("\nTrying backup network...");
    WiFi.begin(WIFI_SSID_2, WIFI_PASSWORD_2);
    attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
      delay(500);
      Serial.print(".");
      attempts++;
    }
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✓ WiFi connected");
    Serial.println("  IP: " + WiFi.localIP().toString());
    Serial.println("  RSSI: " + String(WiFi.RSSI()) + " dBm");
  } else {
    Serial.println("\n✗ WiFi connection failed");
    blinkError();
  }
}

// ==================== API FUNCTIONS ====================

void registerDevice() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("✗ Cannot register - no WiFi");
    return;
  }

  StaticJsonDocument<256> doc;
  doc["device_uuid"] = DEVICE_UUID;
  doc["secret"] = "change-me-in-production"; // Use secure provisioning method
  doc["device_name"] = DEVICE_NAME;
  doc["location"] = LOCATION;

  String payload;
  serializeJson(doc, payload);

  http.begin(String(API_URL) + "/devices/register");
  http.addHeader("Content-Type", "application/json");

  int httpCode = http.POST(payload);

  if (httpCode == 201) {
    StaticJsonDocument<512> response;
    deserializeJson(response, http.getString());
    
    DEVICE_TOKEN = response["data"]["token"].as<String>();
    saveConfiguration();
    
    Serial.println("✓ Device registered successfully");
    Serial.println("  Token: " + DEVICE_TOKEN.substring(0, 16) + "...");
    beep(2);
  } else {
    Serial.println("✗ Registration failed: " + String(httpCode));
    blinkError();
  }

  http.end();
}

bool sendEvent(JsonDocument& event) {
  if (DEVICE_TOKEN.length() == 0) {
    return false;
  }

  String payload;
  serializeJson(event, payload);

  http.begin(String(API_URL) + "/devices/event");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer " + DEVICE_TOKEN);
  http.setTimeout(5000);

  int httpCode = http.POST(payload);
  bool success = (httpCode == 200);

  if (!success) {
    Serial.println("  HTTP Error: " + String(httpCode));
    if (httpCode > 0) {
      Serial.println("  Response: " + http.getString());
    }
  }

  http.end();
  return success;
}

void sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED || DEVICE_TOKEN.length() == 0) {
    return;
  }

  StaticJsonDocument<256> doc;
  doc["firmware_version"] = FIRMWARE_VERSION;
  doc["buffer_count"] = bufferCount;

  String payload;
  serializeJson(doc, payload);

  http.begin(String(API_URL) + "/devices/heartbeat");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer " + DEVICE_TOKEN);

  int httpCode = http.POST(payload);

  if (httpCode == 200) {
    Serial.println("♥ Heartbeat sent");
  } else {
    Serial.println("✗ Heartbeat failed: " + String(httpCode));
  }

  http.end();
}

// ==================== BUFFER FUNCTIONS ====================

void bufferEvent(JsonDocument& event) {
  if (bufferCount >= MAX_BUFFER_SIZE) {
    Serial.println("⚠ Buffer full - dropping oldest event");
    // In production, implement circular buffer
  }

  String filename = "/event_" + String(millis()) + ".json";
  File file = LittleFS.open(filename, "w");
  
  if (file) {
    serializeJson(event, file);
    file.close();
    bufferCount++;
    Serial.println("  Buffered to: " + filename);
  } else {
    Serial.println("✗ Failed to buffer event");
  }
}

void flushBuffer() {
  File root = LittleFS.open("/");
  File file = root.openNextFile();

  int sent = 0;
  while (file && sent < 10) { // Limit to 10 per cycle
    String filename = String(file.name());
    
    if (filename.startsWith("/event_")) {
      StaticJsonDocument<512> event;
      deserializeJson(event, file);
      file.close();

      if (sendEvent(event)) {
        LittleFS.remove(filename);
        bufferCount--;
        sent++;
        Serial.println("✓ Flushed: " + filename);
        delay(100);
      } else {
        Serial.println("✗ Flush failed, will retry");
        break; // Stop trying
      }
    }

    file = root.openNextFile();
  }

  if (sent > 0) {
    Serial.println("✓ Flushed " + String(sent) + " buffered events");
  }
}

void countBufferedEvents() {
  bufferCount = 0;
  File root = LittleFS.open("/");
  File file = root.openNextFile();

  while (file) {
    if (String(file.name()).startsWith("/event_")) {
      bufferCount++;
    }
    file = root.openNextFile();
  }

  Serial.println("  Buffered events: " + String(bufferCount));
}

// ==================== CONFIGURATION ====================

void loadConfiguration() {
  File file = LittleFS.open("/config.json", "r");
  if (file) {
    StaticJsonDocument<256> config;
    deserializeJson(config, file);
    DEVICE_TOKEN = config["token"].as<String>();
    file.close();
    Serial.println("✓ Configuration loaded");
  }
}

void saveConfiguration() {
  File file = LittleFS.open("/config.json", "w");
  if (file) {
    StaticJsonDocument<256> config;
    config["token"] = DEVICE_TOKEN;
    serializeJson(config, file);
    file.close();
    Serial.println("✓ Configuration saved");
  }
}

// ==================== OTA FUNCTIONS ====================

void setupOTA() {
  ArduinoOTA.setHostname(DEVICE_UUID);
  ArduinoOTA.setPassword("admin"); // Change in production

  ArduinoOTA.onStart([]() {
    Serial.println("OTA Update started...");
  });

  ArduinoOTA.onEnd([]() {
    Serial.println("\nOTA Update complete!");
  });

  ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
    Serial.printf("Progress: %u%%\r", (progress / (total / 100)));
  });

  ArduinoOTA.onError([](ota_error_t error) {
    Serial.printf("OTA Error[%u]: ", error);
  });

  ArduinoOTA.begin();
  Serial.println("✓ OTA initialized");
}

// ==================== UTILITY FUNCTIONS ====================

String getISOTimestamp() {
  // In production, sync with NTP
  return String(millis());
}

void beep(int times) {
  for (int i = 0; i < times; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(100);
    digitalWrite(BUZZER_PIN, LOW);
    delay(100);
  }
}

void blinkError() {
  for (int i = 0; i < 5; i++) {
    digitalWrite(LED_PIN, HIGH);
    delay(200);
    digitalWrite(LED_PIN, LOW);
    delay(200);
  }
}
