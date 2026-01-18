/*
 *  ESP32 RFID Attendance System – Dual-Core FreeRTOS (ENHANCED OTA FIX)
 *  Core 1 : RFID + LCD + I/O
 *  Core 0 : Wi-Fi + HTTP + OTA + buffering
 *  https://github.com/EngiiGenius/ESP32-RFID-DualCore 
 *  
 *  ENHANCED OTA FIXES:
 *  - Fixed WiFiClientSecure memory management
 *  - Added proper memory checks before OTA
 *  - Enhanced error handling and recovery
 *  - Fixed Update.begin() failures
 *  - Added download verification
 *  - Improved restart reliability
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <MFRC522.h>
#include <LittleFS.h>
#include <ArduinoOTA.h>
#include <ESPmDNS.h>
#include <Update.h>
#include <Wire.h>
#include <map>
#include <LiquidCrystal_I2C.h>
#include <time.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <freertos/queue.h>
#include <freertos/semphr.h>
#include <esp_task_wdt.h>
#include <Preferences.h>

/* ---------------- CONFIGURATION ---------------- */
const char* WIFI_SSID_1     = "sid";
const char* WIFI_PASSWORD_1 = "";
const char* WIFI_SSID_2     = "EngiiGenius";
const char* WIFI_PASSWORD_2 = "Engii@123";

const char* API_URL_DEFAULT        = "https://attendece-system.onrender.com";
const char* DEVICE_UUID_DEFAULT    = "esp-reader-01";

String WIFI_SSID     = WIFI_SSID_1;
String WIFI_PASSWORD = WIFI_PASSWORD_1;
String API_URL       = API_URL_DEFAULT;
String DEVICE_UUID   = DEVICE_UUID_DEFAULT;
String DEVICE_TOKEN  = "";
String DEVICE_SECRET = "";

const char* FIRMWARE_VERSION = "2.1.5";  // Updated version for OTA Test
const char* DEVICE_NAME      = "incubation attendence Reader";
const char* LOCATION         = "Building A – Ground Floor";
const char* DEVICE_PROVISIONING_SECRET = "my-secure-provisioning-key-2026";
const char* OTA_UPDATE_URL = "https://attendece-system.onrender.com/api/v1/devices/firmware";

// Anti-Passback: Track last event type per card to prevent IN→IN or OUT→OUT
std::map<String, String> lastEventTypeMap;  // UID -> last event type ("IN" or "OUT")

const unsigned long DEBOUNCE_TIME        = 3000;
const unsigned long HEARTBEAT_INTERVAL   = 300000;
const unsigned long LCD_MESSAGE_TIME     = 2000;
const unsigned long RFID_SCAN_INTERVAL   = 50;
const unsigned long NETWORK_CHECK_INTERVAL = 100;
const unsigned long BUFFER_CLEANUP_INTERVAL = 3600000;
const unsigned long WATCHDOG_TIMEOUT_SEC = 30;
const int MAX_BUFFER_SIZE = 500;
const int EVENT_QUEUE_SIZE = 10;
const int MAX_EVENT_RETRIES = 3;
const int MIN_FREE_HEAP_FOR_OTA = 150000;  // Minimum heap for OTA

#define RST_PIN      27
#define SS_PIN       5
#define LED_GREEN    2
#define LED_RED      15
#define BUZZER_PIN   4
#define CONFIG_BTN   0

#define LCD_SDA  21
#define LCD_SCL  22
#define LCD_ADDR 0x27

#define RFID_CORE    1
#define NETWORK_CORE 0

#define RFID_TASK_PRIORITY    3
#define NETWORK_TASK_PRIORITY 2
#define LCD_TASK_PRIORITY     1

#define RFID_STACK_SIZE    4096
#define NETWORK_STACK_SIZE 8192
#define LCD_STACK_SIZE     2048
/* ----------------------------------------------- */

MFRC522 mfrc522(SS_PIN, RST_PIN);
LiquidCrystal_I2C lcd(LCD_ADDR, 16, 2);
Preferences preferences;

unsigned long lastHeartbeat = 0, lastScanTime = 0, lastLcdUpdate = 0;
unsigned long lastBufferCleanup = 0;
String lastScannedUID = "";
int bufferCount = 0;
bool showingMessage = false;
volatile bool wifiConnected = false;
volatile bool deviceRegistered = false;
volatile bool useWiFiManager = false;

struct ErrorStats {
  uint32_t wifiDisconnects;
  uint32_t httpErrors;
  uint32_t bufferOverflows;
  uint32_t ntpSyncFailures;
  uint32_t tokenExpired;
  uint32_t otaFailures;
} errorStats = {0};

/* FreeRTOS objects */
struct RfidEvent {
  char uid[24];
  char timestamp[25];
  int rssi;
  bool pending;
};
struct EventResponse {
  bool success;
  char employeeName[32];
  char eventType[8];
  char responseUid[24];
  bool buffered;
};
struct LcdMessage {
  uint8_t type;
  char line1[17], line2[17];
};

QueueHandle_t rfidEventQueue, responseQueue, lcdQueue;
SemaphoreHandle_t spiMutex, i2cMutex, fsMutex;
TaskHandle_t rfidTaskHandle, networkTaskHandle, lcdTaskHandle;

/* LCD message types */
#define LCD_MSG_STARTUP    0
#define LCD_MSG_CONNECTING 1
#define LCD_MSG_READY      2
#define LCD_MSG_SCANNING   3
#define LCD_MSG_SUCCESS    4
#define LCD_MSG_BUFFERED   5
#define LCD_MSG_ERROR      6
#define LCD_MSG_IDLE       7
#define LCD_MSG_CUSTOM     8

/* Custom glyphs */
byte wifiIcon[8]  = {B00000,B01110,B10001,B00100,B01010,B00000,B00100,B00000};
byte checkIcon[8] = {B00000,B00001,B00010,B10100,B01000,B00000,B00000,B00000};
byte crossIcon[8] = {B00000,B10001,B01010,B00100,B01010,B10001,B00000,B00000};
byte cardIcon[8]  = {B11111,B10001,B10001,B11111,B10001,B10001,B11111,B00000};

/* ---------------- FUNCTION HEADERS ---------------- */
void rfidTask(void* pv);
void networkTask(void* pv);
void setupWiFiManager();
void connectWiFi();
void registerDevice();
bool sendEventToServer(RfidEvent& e, EventResponse& r, int maxRetries = MAX_EVENT_RETRIES);
void sendHeartbeat();
void bufferEvent(RfidEvent& e);
void flushBuffer();
void countBufferedEvents();
void cleanOldBufferedEvents();
void loadConfiguration();
void saveConfiguration();
void setupOTA();
String getISOTimestamp();
String getCurrentTime();
String getCurrentDate();
String generateDeviceSecret();
void beep(int n);
void beepSuccess();
void beepError();
void beepCheckIn();
void beepCheckOut();
void blinkLed(int n, int d);
void ledSuccess();
void ledError();
void ledCheckIn();
void ledCheckOut();
void logCrash(String reason);
void checkConfigButton();
void queueLcdMessage(uint8_t t, const char* l1="", const char* l2="");
void processLcdMessage(LcdMessage& m);
void setupMDNS();
void checkHttpOTA();
bool checkAntiPassback(const String& uid, const String& eventType);
void updateAntiPassback(const String& uid, const String& eventType);
void lcdTask(void* pv);
bool performHttpOTAUpdate(const String& binURL, const String& expectedVersion, const String& md5Hash);
/* -------------------------------------------------- */

void setup() {
  Serial.begin(115200);
  Serial.println("\n\n=============================================");
  Serial.println("ESP32 RFID Attendance System – DUAL CORE");
  Serial.println("Firmware: " + String(FIRMWARE_VERSION) + " (ENHANCED OTA FIX)");
  Serial.println("=============================================\n");

  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_RED, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(CONFIG_BTN, INPUT_PULLUP);
  digitalWrite(LED_GREEN, LOW);
  digitalWrite(LED_RED, LOW);

  spiMutex = xSemaphoreCreateMutex();
  i2cMutex = xSemaphoreCreateMutex();
  fsMutex  = xSemaphoreCreateMutex();

  rfidEventQueue = xQueueCreate(EVENT_QUEUE_SIZE, sizeof(RfidEvent));
  responseQueue  = xQueueCreate(EVENT_QUEUE_SIZE, sizeof(EventResponse));
  lcdQueue       = xQueueCreate(5, sizeof(LcdMessage));

  Serial.println("Initializing LCD...");
  Wire.begin(LCD_SDA, LCD_SCL);
  lcd.init();
  lcd.backlight();
  delay(100);
  lcd.createChar(0, wifiIcon);
  lcd.createChar(1, checkIcon);
  lcd.createChar(2, crossIcon);
  lcd.createChar(3, cardIcon);
  Serial.println("✓ LCD initialized");
  
  lcd.clear();
  lcd.setCursor(1,0); lcd.print("RFID Attend");
  lcd.setCursor(2,1); lcd.print("DUAL CORE");
  delay(1500);

  Serial.println("Initializing SPI and RFID...");
  SPI.begin();
  mfrc522.PCD_Init();
  delay(100);
  byte v = mfrc522.PCD_ReadRegister(mfrc522.VersionReg);
  if (v == 0x00 || v == 0xFF) {
    Serial.println("✗ RC522 not found");
    lcd.clear(); lcd.print("RFID Error!");
    while (1) delay(1000);
  }
  Serial.println("✓ RC522 ok (0x" + String(v, HEX) + ")");

  if (!LittleFS.begin(true)) {
    Serial.println("✗ LittleFS mount failed");
  } else {
    Serial.println("✓ LittleFS mounted");
    loadConfiguration();
    countBufferedEvents();
  }

  lcd.clear();
  lcd.setCursor(0,0); lcd.write(byte(0)); lcd.print(" Connecting...");
  lcd.setCursor(0,1); lcd.print(String(WIFI_SSID_1).substring(0,16));
  
  setupWiFiManager();
  wifiConnected = (WiFi.status() == WL_CONNECTED);

  const long gmtOffset_sec = 19800;
  const int daylightOffset_sec = 0;
  configTime(gmtOffset_sec, daylightOffset_sec, "in.pool.ntp.org", "asia.pool.ntp.org", "pool.ntp.org");
  Serial.println("[TIME] Waiting for NTP sync (IST)...");
  struct tm timeinfo;
  int attempts = 0;
  while (!getLocalTime(&timeinfo) && attempts < 10) {
    vTaskDelay(pdMS_TO_TICKS(1000));
    Serial.print(".");
    attempts++;
  }
  if (getLocalTime(&timeinfo)) {
    Serial.println("\n[TIME] NTP synced (IST): " + String(timeinfo.tm_year + 1900));
  } else {
    Serial.println("\n[TIME] NTP sync failed - timestamps will use server time");
    errorStats.ntpSyncFailures++;
  }
  
  Serial.println("Initializing watchdog timer...");
  esp_task_wdt_init(WATCHDOG_TIMEOUT_SEC, true);
  Serial.println("✓ Watchdog timer enabled (" + String(WATCHDOG_TIMEOUT_SEC) + "s)");
  setupOTA();
  setupMDNS();

  if (DEVICE_TOKEN.length() == 0 && wifiConnected) {
    Serial.println("⚠ Device not registered – trying registration...");
    lcd.clear(); lcd.print("Registering...");
    registerDevice();
  }
  deviceRegistered = (DEVICE_TOKEN.length() > 0);

  Serial.println("\n🚀 Starting FreeRTOS tasks...\n");

  xTaskCreatePinnedToCore(rfidTask,   "RFID_Task",   RFID_STACK_SIZE,   NULL, RFID_TASK_PRIORITY,   &rfidTaskHandle,   RFID_CORE);
  xTaskCreatePinnedToCore(networkTask,"Network_Task",NETWORK_STACK_SIZE,NULL,NETWORK_TASK_PRIORITY,&networkTaskHandle,NETWORK_CORE);
  xTaskCreatePinnedToCore(lcdTask,    "LCD_Task",    LCD_STACK_SIZE,    NULL, LCD_TASK_PRIORITY,    &lcdTaskHandle,    RFID_CORE);

  esp_task_wdt_add(rfidTaskHandle);
  esp_task_wdt_add(networkTaskHandle);
  esp_task_wdt_add(lcdTaskHandle);
  Serial.println("✓ Tasks added to watchdog");

  digitalWrite(BUZZER_PIN, HIGH);
  delay(100);
  digitalWrite(BUZZER_PIN, LOW);
  
  Serial.println("\n=============================================");
  Serial.println("System running – waiting for RFID cards …");
  Serial.println("=============================================\n");
}

void loop() { vTaskDelay(portMAX_DELAY); }

/* ===================================================================
 *  RFID TASK – Core 1
 * =================================================================== */
void rfidTask(void* pv) {
  Serial.println("[RFID] Task on Core " + String(xPortGetCoreID()));
  String lastUID = "";
  unsigned long lastScan = 0;

  while (true) {
    if (mfrc522.PICC_IsNewCardPresent() && mfrc522.PICC_ReadCardSerial()) {
      String uid = "";
      for (byte i = 0; i < mfrc522.uid.size; i++) {
        if (mfrc522.uid.uidByte[i] < 0x10) uid += "0";
        uid += String(mfrc522.uid.uidByte[i], HEX);
        if (i < mfrc522.uid.size - 1) uid += ":";
      }
      uid.toUpperCase();
      unsigned long now = millis();

      if (uid != lastUID || (now - lastScan) >= DEBOUNCE_TIME) {
        lastUID = uid; lastScan = now;
        Serial.println("\n📡 [RFID] Card: " + uid);

        ledCheckIn();
        LcdMessage m; m.type = LCD_MSG_SCANNING;
        strncpy(m.line2, uid.c_str(), 16); m.line2[16] = '\0';
        xQueueSend(lcdQueue, &m, 0);

        RfidEvent e;
        strncpy(e.uid, uid.c_str(), 23); e.uid[23] = '\0';
        String ts = getISOTimestamp();
        strncpy(e.timestamp, ts.c_str(), 24); e.timestamp[24] = '\0';
        e.rssi = WiFi.RSSI(); e.pending = true;

        if (xQueueSend(rfidEventQueue, &e, 0) != pdTRUE) {
          Serial.println("    [RFID] Queue full – buffering locally");
          if (xSemaphoreTake(fsMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
            bufferEvent(e); xSemaphoreGive(fsMutex);
          }
          queueLcdMessage(LCD_MSG_BUFFERED); beepError();
        }

        EventResponse staleResp;
        while (xQueueReceive(responseQueue, &staleResp, 0) == pdTRUE) {
          Serial.println("    [RFID] Cleared stale response from queue");
        }

        EventResponse r;
        memset(&r, 0, sizeof(r));
        if (xQueueReceive(responseQueue, &r, pdMS_TO_TICKS(5000)) == pdTRUE) {
          if (strcmp(r.responseUid, uid.c_str()) != 0) {
            Serial.println("    [RFID] ⚠ Response UID mismatch! Expected: " + uid + ", Got: " + String(r.responseUid));
            queueLcdMessage(LCD_MSG_ERROR, "", "Sync Error");
            ledError(); beepError();
          } else if (r.success) {
            Serial.println("    [RFID] ✓ Server: " + String(r.employeeName) + " (" + String(r.eventType) + ")");
            updateAntiPassback(uid, String(r.eventType));
            
            if (strcmp(r.eventType, "IN") == 0) {
              ledCheckIn(); beepCheckIn();
            } else if (strcmp(r.eventType, "OUT") == 0) {
              ledCheckOut(); beepCheckOut();
            } else {
              ledSuccess(); beepSuccess();
            }
            
            LcdMessage ok; ok.type = LCD_MSG_SUCCESS;
            if (strcmp(r.eventType, "IN") == 0) {
              strncpy(ok.line1, "CHECK IN!", 16);
            } else if (strcmp(r.eventType, "OUT") == 0) {
              strncpy(ok.line1, "CHECK OUT!", 16);
            } else {
              strncpy(ok.line1, "Welcome!", 16);
            }
            ok.line1[16] = '\0';
            strncpy(ok.line2, r.employeeName, 16); ok.line2[16] = '\0';
            xQueueSend(lcdQueue, &ok, 0);
          } else if (r.buffered) {
            Serial.println("    [RFID] ⚠ Buffered offline");
            queueLcdMessage(LCD_MSG_BUFFERED); ledError(); beepError();
          } else {
            Serial.println("    [RFID] ✗ Failed");
            queueLcdMessage(LCD_MSG_ERROR, "", "Send Failed"); 
            ledError(); beepError();
          }
        } else {
          Serial.println("    [RFID] ⚠ Response timeout – buffered");
          queueLcdMessage(LCD_MSG_BUFFERED);
          ledError(); beepError();
        }
        
        digitalWrite(LED_GREEN, LOW);
        digitalWrite(LED_RED, LOW);
        vTaskDelay(pdMS_TO_TICKS(LCD_MESSAGE_TIME));
        queueLcdMessage(LCD_MSG_READY);
      } else {
        Serial.println("⊘ [RFID] Duplicate ignored: " + uid);
      }
      mfrc522.PICC_HaltA(); mfrc522.PCD_StopCrypto1();
    }
    
    esp_task_wdt_reset();
    vTaskDelay(pdMS_TO_TICKS(RFID_SCAN_INTERVAL));
  }
}

/* ===================================================================
 *  NETWORK TASK – Core 0
 * =================================================================== */
void networkTask(void* pv) {
  Serial.println("[NET] Task on Core " + String(xPortGetCoreID()));
  HTTPClient http;
  unsigned long lastHB = 0, lastWifiChk = 0, lastRegRetry = 0;
  unsigned int heartbeatCount = 0;

  while (true) {
    unsigned long now = millis();

    if (now - lastBufferCleanup >= BUFFER_CLEANUP_INTERVAL) {
      lastBufferCleanup = now;
      if (xSemaphoreTake(fsMutex, pdMS_TO_TICKS(500)) == pdTRUE) {
        cleanOldBufferedEvents();
        xSemaphoreGive(fsMutex);
      }
    }

    if (now - lastWifiChk >= 5000) {
      lastWifiChk = now;
      if (WiFi.status() != WL_CONNECTED) {
        wifiConnected = false;
        errorStats.wifiDisconnects++;
        Serial.println("[NET] WiFi lost – reconnecting …");
        queueLcdMessage(LCD_MSG_CONNECTING);
        connectWiFi();
        wifiConnected = (WiFi.status() == WL_CONNECTED);
        if (wifiConnected) queueLcdMessage(LCD_MSG_READY);
      } else wifiConnected = true;
    }

    if (wifiConnected && !deviceRegistered && (now - lastRegRetry >= 30000)) {
      lastRegRetry = now;
      Serial.println("[NET] Auto-retry registration...");
      registerDevice();
      deviceRegistered = (DEVICE_TOKEN.length() > 0);
    }

    ArduinoOTA.handle();

    RfidEvent e;
    if (xQueueReceive(rfidEventQueue, &e, pdMS_TO_TICKS(10)) == pdTRUE) {
      Serial.println("[NET] Processing UID: " + String(e.uid));
      Serial.println("[NET] WiFi: " + String(wifiConnected ? "YES" : "NO") + 
                     ", Registered: " + String(deviceRegistered ? "YES" : "NO"));
      
      EventResponse r;
      memset(&r, 0, sizeof(r));
      r.success = false;
      r.buffered = false;
      strncpy(r.responseUid, e.uid, 23);
      r.responseUid[23] = '\0';
      
      if (wifiConnected && deviceRegistered) {
        Serial.println("[NET] Attempting to send to server...");
        if (sendEventToServer(e, r, MAX_EVENT_RETRIES)) {
          r.success = true;
        } else {
          Serial.println("[NET] Send failed after retries - buffering");
          if (xSemaphoreTake(fsMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
            bufferEvent(e); xSemaphoreGive(fsMutex);
          }
          r.buffered = true;
        }
      } else {
        Serial.println("[NET] Not ready - buffering (WiFi: " + 
                       String(wifiConnected ? "OK" : "NO") + ", Reg: " + 
                       String(deviceRegistered ? "OK" : "NO") + ")");
        if (xSemaphoreTake(fsMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
          bufferEvent(e); xSemaphoreGive(fsMutex);
        }
        r.buffered = true;
      }
      xQueueSend(responseQueue, &r, pdMS_TO_TICKS(100));
    }

    if (wifiConnected && deviceRegistered && bufferCount > 0) {
      if (xSemaphoreTake(fsMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
        flushBuffer(); xSemaphoreGive(fsMutex);
      }
    }

    if (now - lastHB >= HEARTBEAT_INTERVAL) {
      lastHB = now;
      if (wifiConnected && deviceRegistered) {
        sendHeartbeat();
        heartbeatCount++;
        if (heartbeatCount >= 10) {
          heartbeatCount = 0;
          checkHttpOTA();
        }
      }
    }
    
    checkConfigButton();
    esp_task_wdt_reset();
    vTaskDelay(pdMS_TO_TICKS(NETWORK_CHECK_INTERVAL));
  }
}

/* ===================================================================
 *  LCD TASK – Core 1
 * =================================================================== */
void lcdTask(void* pv) {
  Serial.println("[LCD] Task on Core " + String(xPortGetCoreID()));
  vTaskDelay(pdMS_TO_TICKS(100));
  
  if (xSemaphoreTake(i2cMutex, pdMS_TO_TICKS(1000)) == pdTRUE) {
    lcd.clear();
    lcd.setCursor(0,0); lcd.write(byte(0));
    if (wifiConnected) {
      lcd.print(" Ready");
      int r = WiFi.RSSI();
      String s = r > -50 ? "+++" : r > -70 ? "++" : "+";
      lcd.setCursor(13,0); lcd.print(s);
    } else {
      lcd.print(" OFFLINE");
    }
    lcd.setCursor(0,1); lcd.write(byte(3)); lcd.print(" Scan card...");
    xSemaphoreGive(i2cMutex);
  }
  
  unsigned long lastIdle = 0; bool showingTemp = false;
  while (true) {
    LcdMessage m;
    if (xQueueReceive(lcdQueue, &m, pdMS_TO_TICKS(100)) == pdTRUE) {
      if (xSemaphoreTake(i2cMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
        processLcdMessage(m); xSemaphoreGive(i2cMutex);
      }
      showingTemp = (m.type == LCD_MSG_SCANNING || m.type == LCD_MSG_SUCCESS ||
                     m.type == LCD_MSG_BUFFERED  || m.type == LCD_MSG_ERROR);
    }
    unsigned long now = millis();
    if (!showingTemp && now - lastIdle >= 1000) {
      lastIdle = now;
      if (xSemaphoreTake(i2cMutex, pdMS_TO_TICKS(50)) == pdTRUE) {
        lcd.setCursor(0,0); lcd.write(byte(0));
        if (wifiConnected) {
          lcd.print(" " + getCurrentTime() + " ");
          lcd.print(getCurrentDate());
        } else lcd.print(" OFFLINE      ");
        xSemaphoreGive(i2cMutex);
      }
    }
    
    esp_task_wdt_reset();
    vTaskDelay(pdMS_TO_TICKS(50));
  }
}

/* ===================================================================
 *  Wi-Fi
 * =================================================================== */
void setupWiFiManager() {
  Serial.println("[NET] Starting Dual WiFi Manager...");
  preferences.begin("wifi", false);
  
  String savedSSID = preferences.getString("ssid", "");
  String savedPass = preferences.getString("pass", "");
  
  if (savedSSID.length() > 0) {
    Serial.println("[NET] Trying saved WiFi: " + savedSSID);
    WIFI_SSID = savedSSID;
    WIFI_PASSWORD = savedPass;
    connectWiFi();
    
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("[NET] ✓ Connected to saved network");
      preferences.end();
      return;
    }
  }
  
  Serial.println("[NET] Trying Network 1: " + String(WIFI_SSID_1));
  WIFI_SSID = WIFI_SSID_1;
  WIFI_PASSWORD = WIFI_PASSWORD_1;
  connectWiFi();
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("[NET] ✓ Connected to Network 1");
    preferences.putString("ssid", WIFI_SSID);
    preferences.putString("pass", WIFI_PASSWORD);
    preferences.end();
    return;
  }
  
  Serial.println("[NET] Network 1 failed. Trying Network 2: " + String(WIFI_SSID_2));
  WIFI_SSID = WIFI_SSID_2;
  WIFI_PASSWORD = WIFI_PASSWORD_2;
  connectWiFi();
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("[NET] ✓ Connected to Network 2");
    preferences.putString("ssid", WIFI_SSID);
    preferences.putString("pass", WIFI_PASSWORD);
  } else {
    Serial.println("[NET] ✗ All WiFi networks failed - will operate in offline mode");
  }
  
  preferences.end();
}

void connectWiFi() {
  Serial.print("[NET] Connecting to "); Serial.println(WIFI_SSID);
  WiFi.mode(WIFI_STA); 
  WiFi.begin(WIFI_SSID.c_str(), WIFI_PASSWORD.c_str());
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    vTaskDelay(pdMS_TO_TICKS(500)); Serial.print(".");
    attempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✓ WiFi connected – IP: " + WiFi.localIP().toString() +
                   "  RSSI: " + String(WiFi.RSSI()) + " dBm");
  } else {
    Serial.println("\n✗ WiFi failed");
    blinkLed(5, 200);
  }
}

/* ===================================================================
 *  API
 * =================================================================== */
void registerDevice() {
  if (WiFi.status() != WL_CONNECTED) return;
  
  if (DEVICE_SECRET.length() == 0) {
    DEVICE_SECRET = String(DEVICE_PROVISIONING_SECRET);
    Serial.println("[NET] Using provisioning secret for registration");
  }
  
  Serial.println("[NET] Registering device …");
  Serial.println("[NET] Target: " + API_URL + "/api/v1/devices/register");
  
  WiFiClientSecure *client = new WiFiClientSecure;
  if (!client) {
    Serial.println("✗ Failed to create HTTPS client");
    return;
  }
  
  client->setInsecure();
  
  HTTPClient http;
  StaticJsonDocument<256> doc;
  doc["device_uuid"] = DEVICE_UUID;
  doc["secret"]      = DEVICE_SECRET;
  doc["device_name"] = DEVICE_NAME;
  doc["location"]    = LOCATION;
  String payload; serializeJson(doc, payload);
  
  Serial.println("[NET] Payload: " + payload);
  
  http.begin(*client, API_URL + "/api/v1/devices/register");
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(15000);
  
  Serial.println("[NET] Sending POST...");
  int httpCode = http.POST(payload);
  
  Serial.println("[NET] Response code: " + String(httpCode));
  
  if (httpCode == 201 || httpCode == 200) {
    StaticJsonDocument<512> resp; deserializeJson(resp, http.getString());
    DEVICE_TOKEN = resp["data"]["token"].as<String>();
    if (xSemaphoreTake(fsMutex, pdMS_TO_TICKS(1000)) == pdTRUE) {
      saveConfiguration(); xSemaphoreGive(fsMutex);
    }
    if (httpCode == 201) {
      Serial.println("✓ Device registered – token: " + DEVICE_TOKEN.substring(0, 20) + "…");
    } else {
      Serial.println("✓ Token re-issued (device existed) – token: " + DEVICE_TOKEN.substring(0, 20) + "…");
    }
    deviceRegistered = true;
    beepSuccess();
  } else if (httpCode == 409) {
    Serial.println("⚠ Device already exists (THIS SHOULD NOT HAPPEN ANYMORE)");
  } else {
    Serial.println("✗ Registration failed: " + String(httpCode));
    if (httpCode > 0) {
      Serial.println("  Resp: " + http.getString());
      errorStats.httpErrors++;
    }
    else if (httpCode == -11) Serial.println("  → Timeout (server not responding or firewall blocking)");
    else if (httpCode == -1) Serial.println("  → Connection refused (server not listening)");
  }
  http.end();
  delete client;
}

bool sendEventToServer(RfidEvent& e, EventResponse& r, int maxRetries) {
  if (DEVICE_TOKEN.length() == 0) {
    Serial.println("  [NET] No token available");
    return false;
  }
  
  int retryDelay = 1000;
  
  for (int attempt = 1; attempt <= maxRetries; attempt++) {
    if (attempt > 1) {
      Serial.println("  [NET] Retry " + String(attempt) + "/" + String(maxRetries));
      vTaskDelay(pdMS_TO_TICKS(retryDelay));
      retryDelay *= 2;
    }
    
    Serial.println("  [NET] Sending with token: " + DEVICE_TOKEN.substring(0, 20) + "...");
    
    WiFiClientSecure *client = new WiFiClientSecure;
    if (!client) {
      Serial.println("  [NET] Failed to create HTTPS client");
      return false;
    }
    
    client->setInsecure();
    
    HTTPClient http;
    StaticJsonDocument<256> doc;
    doc["device_uuid"] = DEVICE_UUID;
    doc["tag_uid"]     = e.uid;
    doc["timestamp"]   = e.timestamp;
    doc["rssi"]        = e.rssi;
    String payload; serializeJson(doc, payload);
    
    Serial.println("  [NET] Payload: " + payload);
    
    http.begin(*client, API_URL + "/api/v1/devices/event");
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", "Bearer " + DEVICE_TOKEN);
    http.setTimeout(10000);
    int httpCode = http.POST(payload);
    
    if (httpCode == 200) {
      StaticJsonDocument<512> resp;
      deserializeJson(resp, http.getString());
      String name = resp["data"]["employee_name"] | "Scan OK";
      String eventType = resp["data"]["event_type"] | "SCAN";
      
      strncpy(r.employeeName, name.c_str(), 31); r.employeeName[31] = '\0';
      strncpy(r.eventType, eventType.c_str(), 7); r.eventType[7] = '\0';
      Serial.println("  [NET] ✓ Event sent: " + eventType);
      http.end();
      delete client;
      return true;
    } else if (httpCode == 401) {
      Serial.println("  [NET] Token expired - re-registering");
      errorStats.tokenExpired++;
      http.end();
      delete client;
      registerDevice();
      continue;
    } else {
      Serial.println("  [NET] HTTP error: " + String(httpCode));
      if (httpCode > 0) {
        Serial.println("  [NET] Response: " + http.getString());
        errorStats.httpErrors++;
      }
      http.end();
      delete client;
      if (attempt == maxRetries) return false;
    }
  }
  return false;
}

void sendHeartbeat() {
  if (DEVICE_TOKEN.length() == 0) return;
  
  WiFiClientSecure *client = new WiFiClientSecure;
  if (!client) return;
  client->setInsecure();
  
  HTTPClient http;
  StaticJsonDocument<512> doc;
  doc["firmware_version"] = FIRMWARE_VERSION;
  doc["buffer_count"]     = bufferCount;
  doc["free_heap"]        = ESP.getFreeHeap();
  doc["uptime_ms"]        = millis();
  
  JsonObject errors = doc.createNestedObject("errors");
  errors["wifi_disconnects"] = errorStats.wifiDisconnects;
  errors["http_errors"] = errorStats.httpErrors;
  errors["buffer_overflows"] = errorStats.bufferOverflows;
  errors["ntp_sync_failures"] = errorStats.ntpSyncFailures;
  errors["token_expired"] = errorStats.tokenExpired;
  errors["ota_failures"] = errorStats.otaFailures;
  
  String payload; serializeJson(doc, payload);
  http.begin(*client, String(API_URL) + "/api/v1/devices/heartbeat");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer " + DEVICE_TOKEN);
  int httpCode = http.POST(payload);
  if (httpCode == 200) Serial.println("♥ [NET] Heartbeat sent with error stats");
  else {
    Serial.println("✗ [NET] Heartbeat failed: " + String(httpCode));
    errorStats.httpErrors++;
  }
  http.end();
  delete client;
}

/* ===================================================================
 *  LittleFS helpers
 * =================================================================== */
void bufferEvent(RfidEvent& e) {
  if (bufferCount >= MAX_BUFFER_SIZE) { Serial.println("⚠ Buffer full"); return; }
  String fn = "/event_" + String(millis()) + ".json";
  File f = LittleFS.open(fn, "w");
  if (f) {
    StaticJsonDocument<256> doc;
    doc["uid"] = e.uid; doc["timestamp"] = e.timestamp; doc["rssi"] = e.rssi;
    serializeJson(doc, f); f.close();
    bufferCount++;
    Serial.println("  [FS] Buffered: " + fn);
  } else Serial.println("✗ FS buffer fail");
}

void flushBuffer() {
  File root = LittleFS.open("/");
  File file = root.openNextFile();
  int sent = 0;
  while (file && sent < 3) {
    String fn = "/" + String(file.name());
    if (fn.startsWith("/event_")) {
      StaticJsonDocument<256> doc; deserializeJson(doc, file); file.close();
      RfidEvent e;
      strncpy(e.uid, doc["uid"] | "", 23);
      String currentTs = getISOTimestamp();
      strncpy(e.timestamp, currentTs.c_str(), 24);
      e.rssi = doc["rssi"] | 0;
      EventResponse r;
      if (sendEventToServer(e, r)) {
        LittleFS.remove(fn); bufferCount--; sent++;
        Serial.println("✓ Flushed: " + fn);
        vTaskDelay(pdMS_TO_TICKS(100));
      } else break;
    }
    file = root.openNextFile();
  }
  if (sent) Serial.println("✓ Flushed " + String(sent) + " events");
}

void countBufferedEvents() {
  bufferCount = 0;
  File root = LittleFS.open("/");
  File f = root.openNextFile();
  while (f) {
    if (String(f.name()).startsWith("event_")) bufferCount++;
    f = root.openNextFile();
  }
  Serial.println("  [FS] Buffered count: " + String(bufferCount));
}

void loadConfiguration() {
  File f = LittleFS.open("/config.json", "r");
  if (f) { 
    StaticJsonDocument<256> c; 
    deserializeJson(c, f); 
    DEVICE_TOKEN = c["token"] | ""; 
    f.close();
    if (DEVICE_TOKEN.length() > 0) {
      Serial.println("  [FS] Token loaded: " + DEVICE_TOKEN.substring(0, 20) + "...");
    } else {
      Serial.println("  [FS] Config exists but token is empty");
    }
  } else {
    Serial.println("  [FS] No config file found");
  }
}
void saveConfiguration() {
  File f = LittleFS.open("/config.json", "w");
  if (f) { StaticJsonDocument<256> c; c["token"] = DEVICE_TOKEN; serializeJson(c, f); f.close(); }
}

/* ===================================================================
 *  OTA
 * =================================================================== */
void setupOTA() {
  ArduinoOTA.setHostname(DEVICE_UUID.c_str());
  ArduinoOTA.setPassword("admin");
  ArduinoOTA.onStart([]() {
    Serial.println("[OTA] Start …"); queueLcdMessage(LCD_MSG_CUSTOM, "OTA Update …", "Don't power off!");
  });
  ArduinoOTA.onEnd([]() {
    Serial.println("\n[OTA] Done!"); queueLcdMessage(LCD_MSG_CUSTOM, "Update Done!", "Restarting …");
  });
  ArduinoOTA.onProgress([](unsigned int p, unsigned int t) {
    Serial.printf("Progress: %u%%\r", (p / (t / 100)));
  });
  ArduinoOTA.onError([](ota_error_t e) {
    Serial.printf("[OTA] Error[%u]\n", e); queueLcdMessage(LCD_MSG_ERROR, "", "OTA Failed!");
  });
  ArduinoOTA.begin();
  Serial.println("✓ OTA ready");
}

/* ===================================================================
 *  HTTP OTA (Fixed Version)
 * =================================================================== */
void checkHttpOTA() {
  if (!wifiConnected || DEVICE_TOKEN.length() == 0) {
    Serial.println("[OTA] Skipped - not connected or no token");
    return;
  }
  
  Serial.println("[OTA] Checking for firmware updates...");
  Serial.println("[OTA] Current version: " + String(FIRMWARE_VERSION));
  queueLcdMessage(LCD_MSG_CUSTOM, "Checking OTA...", "");
  
  // Check available memory first
  if (ESP.getFreeHeap() < MIN_FREE_HEAP_FOR_OTA) {
    Serial.println("[OTA] ERROR: Not enough memory for OTA update!");
    Serial.println("[OTA] Free heap: " + String(ESP.getFreeHeap()) + " bytes");
    Serial.println("[OTA] Required: " + String(MIN_FREE_HEAP_FOR_OTA) + " bytes");
    queueLcdMessage(LCD_MSG_ERROR, "", "No memory!");
    return;
  }
  
  WiFiClientSecure *client = new WiFiClientSecure;
  if (!client) {
    Serial.println("[OTA] ERROR: Failed to create HTTPS client");
    queueLcdMessage(LCD_MSG_ERROR, "", "Client error!");
    return;
  }
  
  client->setInsecure();
  client->setTimeout(60000);  // 60 second timeout
  
  HTTPClient http;
  String url = String(OTA_UPDATE_URL) + "?device_uuid=" + DEVICE_UUID + "&version=" + FIRMWARE_VERSION;
  Serial.println("[OTA] URL: " + url);
  
  http.begin(*client, url);
  http.addHeader("Authorization", "Bearer " + DEVICE_TOKEN);
  http.setTimeout(30000);
  
  Serial.println("[OTA] Sending GET request...");
  int httpCode = http.GET();
  Serial.println("[OTA] Response code: " + String(httpCode));
  
  if (httpCode == 200) {
    int contentLength = http.getSize();
    String md5 = http.header("X-MD5");
    String newVersion = http.header("X-Firmware-Version");
    String binURL = http.header("X-Binary-URL");
    
    Serial.println("[OTA] ✓ Update available!");
    Serial.println("[OTA]   Size: " + String(contentLength) + " bytes");
    Serial.println("[OTA]   New version: " + newVersion);
    Serial.println("[OTA]   MD5: " + md5);
    Serial.println("[OTA]   Binary URL: " + binURL);
    
    if (contentLength > 0 && binURL.length() > 0) {
      // Perform the actual OTA update
      bool otaSuccess = performHttpOTAUpdate(binURL, newVersion, md5);
      
      if (otaSuccess) {
        Serial.println("[OTA] ✓✓✓ UPDATE SUCCESSFUL! ✓✓✓");
        Serial.println("[OTA] Rebooting in 3 seconds...");
        queueLcdMessage(LCD_MSG_CUSTOM, "Update Done!", "Restarting...");
        
        vTaskDelay(pdMS_TO_TICKS(3000));
        Serial.flush();
        ESP.restart();
      } else {
        Serial.println("[OTA] ✗ OTA update failed");
        queueLcdMessage(LCD_MSG_ERROR, "", "Update failed!");
        errorStats.otaFailures++;
      }
    } else {
      Serial.println("[OTA] ERROR: Invalid response headers");
    }
  } else if (httpCode == 304) {
    Serial.println("[OTA] ✓ Firmware is up to date");
  } else if (httpCode == 401) {
    Serial.println("[OTA] ERROR: Unauthorized - token may be invalid");
  } else if (httpCode == 404) {
    Serial.println("[OTA] No firmware available on server");
  } else {
    Serial.println("[OTA] ERROR: Check failed with code " + String(httpCode));
    if (httpCode > 0) {
      Serial.println("[OTA] Response: " + http.getString());
    }
  }
  
  http.end();
  delete client;
  
  Serial.println("[OTA] Check complete");
}

bool performHttpOTAUpdate(const String& binURL, const String& expectedVersion, const String& md5Hash) {
  Serial.println("[OTA] Starting HTTP OTA update...");
  Serial.println("[OTA] Free heap before: " + String(ESP.getFreeHeap()) + " bytes");
  
  // Verify WiFi is still connected
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[OTA] ERROR: WiFi lost during update!");
    return false;
  }
  
  String sizeMsg = "Size: " + String(ESP.getFreeHeap()/1024) + " KB";
  queueLcdMessage(LCD_MSG_CUSTOM, "Downloading...", sizeMsg.c_str());
  
  WiFiClientSecure updateClient;
  updateClient.setInsecure();
  updateClient.setTimeout(60000);
  
  HTTPClient httpUpdate;
  httpUpdate.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
  httpUpdate.begin(updateClient, binURL);
  httpUpdate.addHeader("Authorization", "Bearer " + DEVICE_TOKEN);
  httpUpdate.setTimeout(60000);
  
  Serial.println("[OTA] Connecting to binary URL...");
  int httpCode = httpUpdate.GET();
  
  if (httpCode != 200) {
    Serial.println("[OTA] ERROR: Failed to download binary - HTTP " + String(httpCode));
    httpUpdate.end();
    return false;
  }
  
  int contentLength = httpUpdate.getSize();
  Serial.println("[OTA] Binary size: " + String(contentLength) + " bytes");
  
  if (contentLength <= 0) {
    Serial.println("[OTA] ERROR: Invalid binary size");
    httpUpdate.end();
    return false;
  }
  
  // Check available flash space
  bool canBegin = Update.begin(contentLength);
  if (!canBegin) {
    Serial.println("[OTA] ERROR: Not enough space to begin OTA");
    Serial.println("[OTA] Required: " + String(contentLength) + " bytes");
    Serial.println("[OTA] Free sketch space: " + String(ESP.getFreeSketchSpace()) + " bytes");
    Update.printError(Serial);
    httpUpdate.end();
    return false;
  }
  
  Serial.println("[OTA] ✓ Update.begin() successful");
  
  // Set MD5 if provided
  if (md5Hash.length() > 0) {
    Update.setMD5(md5Hash.c_str());
    Serial.println("[OTA] MD5 verification enabled: " + md5Hash);
  }
  
  // Download and write firmware
  WiFiClient& stream = httpUpdate.getStream();
  size_t written = 0;
  size_t totalLength = contentLength;
  int lastProgress = 0;
  const size_t bufferSize = 1024;
  uint8_t* buffer = (uint8_t*)malloc(bufferSize);
  
  if (!buffer) {
    Serial.println("[OTA] ERROR: Failed to allocate download buffer");
    httpUpdate.end();
    return false;
  }
  
  Serial.println("[OTA] Starting download and flash...");
  
  while (httpUpdate.connected() && (written < totalLength)) {
    size_t available = stream.available();
    if (available) {
      size_t readBytes = stream.readBytes(buffer, min(available, bufferSize));
      if (readBytes > 0) {
        if (Update.write(buffer, readBytes) != readBytes) {
          Serial.println("[OTA] ERROR: Write failed at " + String(written) + " bytes");
          Update.printError(Serial);
          free(buffer);
          httpUpdate.end();
          return false;
        }
        written += readBytes;
        
        // Show progress every 10%
        int progress = (written * 100) / totalLength;
        if (progress >= lastProgress + 10) {
          Serial.println("[OTA] Progress: " + String(progress) + "%");
          String progressMsg = String(progress) + "%";
          queueLcdMessage(LCD_MSG_CUSTOM, "Updating...", progressMsg.c_str());
          lastProgress = progress;
        }
      }
    }
    vTaskDelay(pdMS_TO_TICKS(1));
  }
  
  free(buffer);
  Serial.println("[OTA] Download complete: " + String(written) + "/" + String(totalLength) + " bytes");
  
  // Verify download completeness
  if (written != totalLength) {
    Serial.println("[OTA] ERROR: Incomplete download!");
    Serial.println("[OTA] Expected: " + String(totalLength) + ", Got: " + String(written));
    Update.abort();
    httpUpdate.end();
    return false;
  }
  
  Serial.println("[OTA] ✓ All bytes written successfully");
  
  // Finalize the update
  if (Update.end(true)) {  // true = set boot partition
    Serial.println("[OTA] ✓ Update finalized successfully");
    httpUpdate.end();
    return true;
  } else {
    Serial.println("[OTA] ERROR: Update.end() failed");
    Update.printError(Serial);
    httpUpdate.end();
    return false;
  }
}

/* ===================================================================
 *  mDNS Discovery
 * =================================================================== */
void setupMDNS() {
  if (MDNS.begin(DEVICE_UUID.c_str())) {
    MDNS.addService("rfid-reader", "tcp", 80);
    MDNS.addServiceTxt("rfid-reader", "tcp", "version", FIRMWARE_VERSION);
    MDNS.addServiceTxt("rfid-reader", "tcp", "location", LOCATION);
    Serial.println("✓ mDNS started: " + DEVICE_UUID + ".local");
  } else {
    Serial.println("✗ mDNS failed to start");
  }
}

/* ===================================================================
 *  Anti-Passback Logic
 * =================================================================== */
bool checkAntiPassback(const String& uid, const String& expectedEventType) {
  if (lastEventTypeMap.find(uid) != lastEventTypeMap.end()) {
    String lastType = lastEventTypeMap[uid];
    if (lastType == expectedEventType) {
      Serial.println("    [ANTI-PASSBACK] Blocked: " + uid + " already " + lastType);
      return false;
    }
  }
  return true;
}

void updateAntiPassback(const String& uid, const String& eventType) {
  lastEventTypeMap[uid] = eventType;
  Serial.println("    [ANTI-PASSBACK] Updated: " + uid + " -> " + eventType);
}

/* ===================================================================
 *  Utils
 * =================================================================== */
String getISOTimestamp() {
  struct tm ti;
  if (!getLocalTime(&ti)) return "";
  if (ti.tm_year + 1900 < 2020 || ti.tm_year + 1900 > 2100) return "";
  
  char b[30]; 
  strftime(b, sizeof(b), "%Y-%m-%dT%H:%M:%S+05:30", &ti);
  return String(b);
}

String getCurrentTime() {
  struct tm ti; 
  if (!getLocalTime(&ti)) return "--:--";
  char b[6]; 
  strftime(b, sizeof(b), "%H:%M", &ti); 
  return String(b);
}

String getCurrentDate() {
  struct tm ti; 
  if (!getLocalTime(&ti)) return "--/--";
  char b[6]; 
  strftime(b, sizeof(b), "%d/%m", &ti); 
  return String(b);
}

/* ===================================================================
 *  ENHANCED FEEDBACK FUNCTIONS
 * =================================================================== */
void ledSuccess() {
  digitalWrite(LED_GREEN, HIGH);
  vTaskDelay(pdMS_TO_TICKS(500));
  digitalWrite(LED_GREEN, LOW);
}

void ledError() {
  for (int i = 0; i < 3; i++) {
    digitalWrite(LED_RED, HIGH);
    vTaskDelay(pdMS_TO_TICKS(150));
    digitalWrite(LED_RED, LOW);
    vTaskDelay(pdMS_TO_TICKS(150));
  }
}

void ledCheckIn() {
  digitalWrite(LED_GREEN, HIGH);
  vTaskDelay(pdMS_TO_TICKS(300));
  digitalWrite(LED_GREEN, LOW);
}

void ledCheckOut() {
  digitalWrite(LED_RED, HIGH);
  vTaskDelay(pdMS_TO_TICKS(300));
  digitalWrite(LED_RED, LOW);
}

void beepSuccess() {
  digitalWrite(BUZZER_PIN, HIGH);
  vTaskDelay(pdMS_TO_TICKS(100));
  digitalWrite(BUZZER_PIN, LOW);
}

void beepError() {
  for (int i = 0; i < 3; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    vTaskDelay(pdMS_TO_TICKS(100));
    digitalWrite(BUZZER_PIN, LOW);
    vTaskDelay(pdMS_TO_TICKS(100));
  }
}

void beepCheckIn() {
  digitalWrite(BUZZER_PIN, HIGH);
  vTaskDelay(pdMS_TO_TICKS(100));
  digitalWrite(BUZZER_PIN, LOW);
}

void beepCheckOut() {
  digitalWrite(BUZZER_PIN, HIGH);
  vTaskDelay(pdMS_TO_TICKS(80));
  digitalWrite(BUZZER_PIN, LOW);
  vTaskDelay(pdMS_TO_TICKS(80));
  digitalWrite(BUZZER_PIN, HIGH);
  vTaskDelay(pdMS_TO_TICKS(80));
  digitalWrite(BUZZER_PIN, LOW);
}

String generateDeviceSecret() {
  String secret = "";
  uint8_t mac[6];
  WiFi.macAddress(mac);
  
  secret = String(mac[0], HEX) + String(mac[1], HEX) + 
           String(mac[2], HEX) + String(mac[3], HEX) +
           String(mac[4], HEX) + String(mac[5], HEX) + "-";
  
  uint32_t hash = 0;
  for (int i = 0; i < DEVICE_UUID.length(); i++) {
    hash = hash * 31 + DEVICE_UUID.charAt(i);
  }
  secret += String(hash, HEX) + "-" + String(millis(), HEX);
  
  return secret;
}

void cleanOldBufferedEvents() {
  if (xSemaphoreTake(fsMutex, pdMS_TO_TICKS(2000)) != pdTRUE) return;
  
  unsigned long now = millis();
  int cleaned = 0;
  
  File f = LittleFS.open("/events.bin", "r");
  if (!f) {
    xSemaphoreGive(fsMutex);
    return;
  }
  
  std::vector<RfidEvent> validEvents;
  while (f.available() >= sizeof(RfidEvent)) {
    RfidEvent evt;
    f.read((uint8_t*)&evt, sizeof(RfidEvent));
    
    if (strlen(evt.timestamp) > 0) {
      validEvents.push_back(evt);
    } else {
      cleaned++;
    }
  }
  f.close();
  
  if (cleaned > 0) {
    LittleFS.remove("/events.bin");
    File fw = LittleFS.open("/events.bin", "w");
    if (fw) {
      for (auto& evt : validEvents) {
        fw.write((uint8_t*)&evt, sizeof(RfidEvent));
      }
      fw.close();
      Serial.println("[BUFF] Cleaned " + String(cleaned) + " old events");
    }
  }
  
  xSemaphoreGive(fsMutex);
}

void checkConfigButton() {
  static unsigned long pressStart = 0;
  static bool wasPressed = false;
  
  bool isPressed = (digitalRead(CONFIG_BTN) == LOW);
  
  if (isPressed && !wasPressed) {
    pressStart = millis();
    wasPressed = true;
  } else if (!isPressed && wasPressed) {
    wasPressed = false;
  } else if (isPressed && wasPressed) {
    unsigned long pressDuration = millis() - pressStart;
    
    if (pressDuration >= 5000) {
      Serial.println("[CONFIG] Resetting WiFi...");
      preferences.begin("wifi", false);
      preferences.clear();
      preferences.end();
      
      for (int i = 0; i < 5; i++) {
        digitalWrite(LED_RED, HIGH);
        digitalWrite(LED_GREEN, HIGH);
        digitalWrite(BUZZER_PIN, HIGH);
        vTaskDelay(pdMS_TO_TICKS(200));
        digitalWrite(LED_RED, LOW);
        digitalWrite(LED_GREEN, LOW);
        digitalWrite(BUZZER_PIN, LOW);
        vTaskDelay(pdMS_TO_TICKS(200));
      }
      
      Serial.println("[CONFIG] Rebooting...");
      vTaskDelay(pdMS_TO_TICKS(1000));
      ESP.restart();
    }
  }
}

void logCrash(String reason) {
  Serial.println("[CRASH] " + reason);
  Serial.println("[CRASH] Free heap: " + String(ESP.getFreeHeap()));
  Serial.println("[CRASH] WiFi: " + String(WiFi.status()));
  Serial.println("[CRASH] Uptime: " + String(millis() / 1000) + "s");
  
  for (int i = 0; i < 10; i++) {
    digitalWrite(LED_RED, HIGH);
    digitalWrite(LED_GREEN, HIGH);
    vTaskDelay(pdMS_TO_TICKS(50));
    digitalWrite(LED_RED, LOW);
    digitalWrite(LED_GREEN, LOW);
    vTaskDelay(pdMS_TO_TICKS(50));
  }
}

void beep(int n) { for (int i = 0; i < n; i++) { digitalWrite(BUZZER_PIN, HIGH); vTaskDelay(pdMS_TO_TICKS(100)); digitalWrite(BUZZER_PIN, LOW); vTaskDelay(pdMS_TO_TICKS(100)); } }
void blinkLed(int n, int d) { for (int i = 0; i < n; i++) { digitalWrite(LED_GREEN, HIGH); vTaskDelay(pdMS_TO_TICKS(d)); digitalWrite(LED_GREEN, LOW); vTaskDelay(pdMS_TO_TICKS(d)); } }

/* ===================================================================
 *  LCD helpers
 * =================================================================== */
void queueLcdMessage(uint8_t t, const char* l1, const char* l2) {
  LcdMessage m; m.type = t;
  strncpy(m.line1, l1, 16); m.line1[16] = '\0';
  strncpy(m.line2, l2, 16); m.line2[16] = '\0';
  xQueueSend(lcdQueue, &m, pdMS_TO_TICKS(100));
}

void processLcdMessage(LcdMessage& m) {
  lcd.clear();
  switch (m.type) {
    case LCD_MSG_STARTUP:    lcd.setCursor(1,0); lcd.print("RFID Attend"); lcd.setCursor(2,1); lcd.print("DUAL CORE"); break;
    case LCD_MSG_CONNECTING: lcd.setCursor(0,0); lcd.write(byte(0)); lcd.print(" Connecting..."); lcd.setCursor(0,1); lcd.print(String(WIFI_SSID).substring(0,16)); break;
    case LCD_MSG_READY:
      lcd.setCursor(0,0); lcd.write(byte(0));
      if (wifiConnected) { lcd.print(" Ready"); int r = WiFi.RSSI(); String s = r > -50 ? "+++" : r > -70 ? "++" : "+"; lcd.setCursor(13,0); lcd.print(s); }
      else lcd.print(" OFFLINE");
      lcd.setCursor(0,1); lcd.write(byte(3)); lcd.print(" Scan card..."); break;
    case LCD_MSG_SCANNING:   lcd.setCursor(0,0); lcd.write(byte(3)); lcd.print(" Scanning..."); lcd.setCursor(0,1); lcd.print(m.line2); break;
    case LCD_MSG_SUCCESS:    
      lcd.setCursor(0,0); lcd.write(byte(1)); 
      if (strlen(m.line1) > 0) {
        lcd.print(" " + String(m.line1));
      } else {
        lcd.print(" Welcome!");
      }
      lcd.setCursor(0,1); lcd.print(m.line2); 
      break;
    case LCD_MSG_BUFFERED:   lcd.setCursor(0,0); lcd.print("! Saved Offline"); lcd.setCursor(0,1); lcd.print("Buffer: " + String(bufferCount)); break;
    case LCD_MSG_ERROR:      lcd.setCursor(0,0); lcd.write(byte(2)); lcd.print(" ERROR"); lcd.setCursor(0,1); lcd.print(m.line2); break;
    case LCD_MSG_IDLE:
      lcd.setCursor(0,0); lcd.write(byte(0));
      if (wifiConnected) { lcd.print(" " + getCurrentTime() + " "); lcd.print(getCurrentDate()); }
      else lcd.print(" OFFLINE");
      lcd.setCursor(0,1);
      if (bufferCount > 0) lcd.print("Buffered: " + String(bufferCount));
      else { lcd.write(byte(3)); lcd.print(" Scan card..."); } break;
    case LCD_MSG_CUSTOM:     lcd.setCursor(0,0); lcd.print(m.line1); lcd.setCursor(0,1); lcd.print(m.line2); break;
  }
}
/* ===================================================================
 *  END OF FILE – flash and enjoy
 * =================================================================== */