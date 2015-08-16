// Demo the quad alphanumeric display LED backpack kit
// scrolls through every character, then scrolls Serial
// input onto the display

#include <ctype.h>
#include <Wire.h>
#include "Adafruit_LEDBackpack.h"
#include "Adafruit_GFX.h"

Adafruit_AlphaNum4 alpha4 = Adafruit_AlphaNum4();

bool passing = false;
float startTime = 0.0;
float endTime = 0.0;
float spacing = 30;//In cm
int threshold = 200;
int delayBetweenPasses = 1000;

void setup() {
  Serial.begin(9600);
  
  alpha4.begin(0x70);  // pass in the address
  
  pinMode(A0, INPUT);
  pinMode(A1, INPUT);
  
  clearDisplay();
  delay(2000);

 marquee("INIT  OK");
  
  resetDisplay();
}

String src = "";
int cmd = 0;
int v1History[50];
int v2History[50];
int avgLength = 0;
int lastAvgPushTime = 0;
float avg1 = 0;
float avg2 = 0;
int interval = 600;//600ms * 50  histories = 30s of history for AVG
//Be carful if tweaking AVG history length.
//When computing average it sums up all the history entries on a UINT.
//On arduino uno the max value for a uint is 65535. This means you can
//store up to floor(65535 / 1024) = 63 entries at max. Above this, you
//get the risk to get an UINT overflow that breaks the AVG computation.

void loop() {
  int v1 = analogRead(A0);
  int v2 = analogRead(A1);
  
  if(millis() - lastAvgPushTime > interval) {
    int len = sizeof(v1History) / sizeof(int);
    lastAvgPushTime = millis();
    avgLength = min(avgLength+1, len);
    avg1 = computeAvg(v1, v1History, len);
    avg2 = computeAvg(v2, v2History, len);
  }
  
  if(Serial.available()) {
    //First byte defines command type
    if(cmd == 0) cmd = Serial.read();
    //Ask for photo resistor values
    if(cmd == '0') {
      Serial.print("t:");
      Serial.print(v1);
      Serial.print(":");
      Serial.print(v2);
      Serial.print(":");
      Serial.print(round(avg1));
      Serial.print(":");
      Serial.println(round(avg2));
      cmd = 0;
  
    //Change distance and light threshold values
    }else if(cmd == '1') {
      while(Serial.available()){
        src += char(Serial.read());
      }
      if(src[src.length()-1] != 47) return;//Wait for ending "/"
      
      cmd = 0;
      
      //Read distance
      int index = 0;
      String values[2] = {"", ""};
      for(int j = 0; j < src.length(); j++) {
        if(src[j] <= 57 && src[j] >= 48) {
          values[index] += src[j];
        }else {
          index ++;
        }
      }
      int d = values[0].toInt();
      int t = values[1].toInt();
      src = "";
      
      spacing = d;
      threshold = t;
      
      String message = "DISTANCE = ";
      message += String(d);
      message += "CM    ";
      message += "THRESHOLD = ";
      message += String(t);
      marquee(message);
      
      resetDisplay();
    }
  }
  
  
  if(v1 > threshold && !passing) {
    passing = true;
    startTime = millis();
  }
  
  if(passing && (millis() - startTime) > 1000) {
    for(int i = 0; i < 3; i++) {
      clearDisplay();
      delay(150);
      alpha4.writeDigitAscii(0, 'X');
      alpha4.writeDigitAscii(1, 'X');
      alpha4.writeDigitAscii(2, 'X');
      alpha4.writeDigitAscii(3, 'X');
      alpha4.writeDisplay();
      delay(150);
    }
    resetDisplay();
    
    passing =  false;
  }
  
  if(v1< threshold && v2 > threshold && passing) {
    endTime = millis();
    passing = false;
    computeSpeed();
  }
}

void computeSpeed() {
  float duration = (endTime - startTime);
  float s = spacing / duration * 36;
  String src = "p:" + String(s);
  Serial.println(src);
  String disp = String(round(s));
  int char0 = '0';
  int char1 = '0';
  if(round(s) < 10) char1 = disp[0];
  else {
    char0 = disp[0];
    char1 = disp[1];
  }
  clearDisplay();
  delay(100);
  alpha4.writeDigitAscii(0, char0);
  alpha4.writeDigitAscii(1, char1);
  alpha4.writeDigitAscii(2, 'K');
  alpha4.writeDigitAscii(3, 'H');
  alpha4.writeDisplay();
}

void resetDisplay() {
    alpha4.writeDigitAscii(0, '-');
    alpha4.writeDigitAscii(1, '-');
    alpha4.writeDigitAscii(2, 'K');
    alpha4.writeDigitAscii(3, 'H');
    alpha4.writeDisplay();
}

void clearDisplay() {
    alpha4.writeDigitAscii(0, ' ');
    alpha4.writeDigitAscii(1, ' ');
    alpha4.writeDigitAscii(2, ' ');
    alpha4.writeDigitAscii(3, ' ');
    alpha4.writeDisplay();
}

void displayNumber(int d) {
  String s = String(d);
  int char0 = ' ';
  int char1 = ' ';
  int char2 = ' ';
  int char3 = ' ';
  if(d < 10) {
    char3 = s[0];
  } else if(d < 100) {
    char2 = s[0];
    char3 = s[1];
  } else if(d < 1000) {
    char1 = s[0];
    char2 = s[1];
    char3 = s[2];
  }else{
    char0 = s[0];
    char1 = s[1];
    char2 = s[2];
    char3 = s[3];
  }
  alpha4.writeDigitAscii(0, char0);
  alpha4.writeDigitAscii(1, char1);
  alpha4.writeDigitAscii(2, char2);
  alpha4.writeDigitAscii(3, char3);
  alpha4.writeDisplay(); 
}

void displayString(String s) {
  alpha4.writeDigitAscii(0, s[0]);
  alpha4.writeDigitAscii(1, s[1]);
  alpha4.writeDigitAscii(2, s[2]);
  alpha4.writeDigitAscii(3, s[3]);
  alpha4.writeDisplay(); 
}

void marquee(String s) {
  s = "    " + s + "    ";
  clearDisplay();
  for(int i = 0; i < s.length() - 3; i++) {
    alpha4.writeDigitAscii(0, s[i]);
    alpha4.writeDigitAscii(1, s[i+1]);
    alpha4.writeDigitAscii(2, s[i+2]);
    alpha4.writeDigitAscii(3, s[i+3]);
    alpha4.writeDisplay();
    delay(130);
  }
}

float computeAvg(int v, int a[],int len) {
  if(avgLength == len) {
    for(int i=1; i < avgLength; i++) a[i-1] = a[i];
  }
  a[ avgLength - 1 ] = v;
  unsigned int sum = 0;
  for(int i=0; i < avgLength; i++) {
    sum += a[i];
    //Serial.print(a[i]);
    //Serial.print(",");
  }
  //Serial.println();
  return avgLength == 0? 0.0 : sum / avgLength;  
}
