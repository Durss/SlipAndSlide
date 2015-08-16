# SlipAndSlide
NodeJS &amp; Arduino project to compute Slip&amp;Slide speed and control a Gopro remotely to start shooting when someone uses the Slip&amp;Slide.

# Installation
  Install [NodeJS](https://nodejs.org/)
  Clone Github project locally.
  Run the following command to initialize the project :
    ```npm install```
    This will install all the project's dependencies.
  Upload arduino sketch to your Arduino

# Launch
Open **server.js** and edit the **gopro_password** to match the wifi password of your gopro.
If you don't know your wifi password, try reseting it by following this tutorial :
[http://trendblog.net/reset-your-gopro-wifi-password-in-less-than-2-minutes/](http://trendblog.net/reset-your-gopro-wifi-password-in-less-than-2-minutes/)

Open terminal and run command :
```node server.js COM[X]```
Replace **[X]** by the COM port number of the Arduino.
To know it you can start Arduino IDE, plug in the arduino via USB, and open "Tools" ==> "Port".
For example :
```node server.js COM3```

Once server is runnign, open a web browser and go to [http://localhost:8080](http://localhost:8080) to see the administration page tha will allow you to configure some values to the arduino and control the gopro remotely.