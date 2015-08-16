# SlipAndSlide
NodeJS &amp; Arduino project to compute Slip&amp;Slide speed and control a Gopro remotely to start shooting when someone uses the Slip&amp;Slide.

# Installation
* Install [NodeJS](https://nodejs.org/)
* Clone Github project locally.
* Run the following command to install all the project's dependencies :
 * ```npm install```
* Upload arduino sketch to your Arduino with the [Arduino IDE](https://www.arduino.cc/en/Main/Software)

# Launch
Open the file **server.js** and edit the **gopro_password** var to match the wifi password of your gopro.<br />
If you don't know your wifi password, try reseting it by following [this tutorial](http://trendblog.net/reset-your-gopro-wifi-password-in-less-than-2-minutes/)


Open terminal and run command :<br />
```node server.js COM[X]```<br />
Replace **[X]** by the COM port number of the Arduino.<br />
To know it you can start Arduino IDE, plug in the arduino via USB, and open "Tools" ==> "Port".<br />
For example :<br />
```node server.js COM3```

Once the server is running, open a web browser and go to [http://localhost:8080](http://localhost:8080) to see the administration page tha will allow you to configure some values to the arduino and control the gopro remotely.<br />
Here is what this page looks like :<br />
![Screenshot admin page](/img/screen.png?raw=true "Optional Title")
