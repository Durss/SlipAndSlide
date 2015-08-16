//GOPRO WiFi commands documentation : 
// https://github.com/KonradIT/goprowifihack/blob/master/WiFi-Commands.mkdn
//Reset your gopro wifi :
// http://trendblog.net/reset-your-gopro-wifi-password-in-less-than-2-minutes/


var gopro_password	= 'your_password';//Set the wifi password of your gopro
var filesPath		= '/videos/DCIM/100GOPRO/';//Set path to pictures/videos on gopro
var copyFolder		= 'gopro_extacts';//Folder to copy medias to
var screensFolder	= 'gopro_extacts/screenshots';//folder to save the screenshots extracted from videos

var http		= require('http'),
	serialport 	= require('serialport'),
	url			= require("url"),
	path		= require("path"),
	fs			= require("fs"),
	request		= require('request'),
	storage		= require('node-persist');
	ffmpeg		= require('fluent-ffmpeg');
	GoPro		= require('gopro_hero_api'),
	CameraMode	= GoPro.CameraMode,
	camera		= new GoPro(gopro_password, '10.5.5.9', '8080')
	SerialPort	= serialport.SerialPort;

storage.initSync();

const PORT=8080;
var timeoutStop;
var params = {};
	params['distance']		= storage.getItem("distance") || 30;
	params['threshold']		= storage.getItem("threshold") || 200;
	params['shotDelay']		= storage.getItem("shotDelay") || 500;
	params['videoDuration']	= storage.getItem("videoDuration") || 15000;
	params['currentMode']	= storage.getItem("currentMode") || CameraMode.VIDEO.toString();
	params['screensCount']	= storage.getItem("screensCount") || 5;
	params['screensWidth']	= storage.getItem("screensWidth") || 1280;
	params['screensHeight']	= storage.getItem("screensHeight") || 720;

if(process.argv.length < 3) {
	console.error('Missing port name argument (ex: COM3)');
	process.exit(1);
}

//Create extract folders if they do not exists
if(!fs.existsSync(copyFolder)) fs.mkdir(copyFolder);
if(!fs.existsSync(screensFolder)) fs.mkdir(screensFolder);

//Power gopro ON if necessary and change the capture mode to the one required
camera.ready().then(function () {
	camera.status().then(function (status) {

		if(status.power.toLowerCase() == 'off') {

			console.log("Gopro is OFF, powering it on...")

			camera.power(true).then(function () {

				camera.status().then(function (status) {
					console.log('Gopro powered ON');
					console.log('Setting camera mode to ' + params['currentMode']);
					camera.setCameraMode(parseInt(params['currentMode']));
				}).catch(function (error) { console.log("POWER ERROR :: " + error.message); });

			}).catch(function (error) { console.log("POWER ERROR :: " + error.message); });

		}else{
			console.log('Gopro already ON.');
			console.log('Setting camera mode to ' + params['currentMode']);
			camera.setCameraMode(parseInt(params['currentMode']));
		}

	}).catch(function (error) { console.log("READY ERROR :: " + error.message); });
}).catch(function (error) { console.log("READY ERROR :: " + error.message); });


// get port name from the command line:
var portName = process.argv[2];
var arduinoPort = new SerialPort(portName, {
   baudRate: 9600,
   // look for return and newline at the end of each data packet:
   parser: serialport.parsers.readline("\r\n")
 });


arduinoPort.on('data', onSerialData);

var consoleValue = '';
function onSerialData(data) {
	console.log(":: SERIAL DATA START ::");
	console.log(data);
	console.log(":: SERIAL DATA END ::");
	//Light sensor values sent
	if(/^t:-?[0-9]+:-?[0-9]+:-?[0-9]+:-?[0-9]+$/gi.test(data)) {
		processRequest(undefined, {redirect:true});
		var chunks = data.split(':');
		consoleValue = "Sensor 1 = " + chunks[1]+"\r\n";
		consoleValue += "Sensor 2 = " + chunks[2]+"\r\n";
		consoleValue += "Last 30s average sensor 1 = " + chunks[3]+"\r\n";
		consoleValue += "Last 30s average sensor 2 = " + chunks[4];

	}else

	//Speed detected
	if(/^p:[0-9]+$/gi.test(data)) {
		//Start shooting
		setTimeout(function() {
			console.log('Starting capture.');
			 camera.capture(true).then(function () {
				//If video mode, stop recording after duration
				if(params['currentMode'] == '0') {
					clearTimeout(timeoutStop);
					timeoutStop = setTimeout(function(){
						//Stop rectoding
						console.log('Stop video recording.');
						camera.capture(false);
						//Wait 2s before grabbing the file, jist to be sure it's fully written on gopro
						//This value should probably be higher the higher video lenth is.
						setTimeout( function() {
							camera.requestFileSystem().then(function (fileStructure) {
								console.log("Searching for file to download...");
								var index = fileStructure.length - 1;
								do{
									var file = fileStructure[index]; //Download latest file
									index --;
								}while((!/.*(mp4|avi|mov|jpeg|jpg)$/i.test(file.name) || file.path.toLowerCase() != filesPath.toLowerCase()) && index > -1)
								if(index == -1) {
									console.log("Couldn't find any video or picture to download.")
									return;
								}

								console.log('Copying latest file : ' + file.name);

								camera.copyFile(file.absolutePath +  file.name, copyFolder).then(function (copiedFile) {
									console.log('File copied !');
									console.log(copiedFile);
									//If it's a video and we want to extract screenshots from it, do it.
									if(/.*(mp4|avi|mov)$/i.test(copiedFile.fileName) && params['screensCount'] > 0) {
										console.log('Generate '+params['screensCount']+' screenshots...');
										//TODO count seems not to work properly. Replace with timestamps array of percentage
										var timestamps = [];
										for(var i=0; i < params['screensCount']; i++) timestamps.push(Math.round(i / params['screensCount'] * 100) + '%' )
										ffmpeg(copiedFile.path)
										.screenshots({
												folder:screensFolder,
												timestamps:timestamps,
												// count:params['screensCount'],
												size:params['screensWidth']+'x'+params['screensHeight']
											}
										)
										.on('filenames', function(filenames) {
											console.log('Will generate ' + filenames.join(', '))
										})
										.on('end', function() {
											console.log('Screenshots taken');
										});
									}
								}).catch(function (error) {
									console.log(error.message);
									console.log(error.error);
								});
							});
						}, 2000);
					}, params['videoDuration']);
				}
			}).catch(function (error) {
				console.log("CAPTURE ERROR ::" + error.message);
			});
		}
		, params['shotDelay']);
	}
}


//Create a server
var filename = '';
var httpResponse;
var httpParameters;
var server = http.createServer(function(req, response){
	var uri = url.parse(req.url).pathname;
	filename = path.join(process.cwd(), uri);
	var url_parts = url.parse(req.url, true);
	var query = url_parts.query;

	httpResponse = response;
	httpParameters = query;

	//Ask light sensor values to arduino
	if(query['light'] != undefined) {
		console.log('Get light values from arduino');
		var cmd = '0';
		arduinoPort.write(cmd);
		return;
	}

	//Power off/on the gopro
	if(query['power'] != undefined) {
		console.log('Power ' + query['power']);
		camera.power(query['power']=='on')
	}

	//Sets the capture mode
	if(query['setMode'] != undefined) {
		console.log('Set mode ' + query['setMode']);
		params['currentMode'] = query['setMode'];
		storage.setItem('currentMode', query['setMode']);
		camera.status().then(function (status) {
			camera.setCameraMode(parseInt(query['setMode']));
		}).catch(function (error) { console.log("SET MODE ERROR :: " + error.message); });
	}

	//Deletes all medias from gopro
	if(query['deleteAll'] != undefined) {
		console.log('Delete all files from gopro.');
		camera.deleteAll();
	}

	//Locates the gopro (makes it beep for 1min)
	if(query['locateGoPro'] != undefined) {
		console.log('Locate gopro.');
		camera.locate(true);
		setTimeout(function() {
			camera.locate(false);
			console.log('Stop gopro location.');
		}, 60000)
	}

	//Simulate passing through lasers
	if(query['simulate'] != undefined) {
		console.log('Simulate laser crossing.');
		onSerialData("p:12");
	}

	//If form is submitted, dorward data to arduino
	if(query['distance'] != undefined && query['threshold'] != undefined) {
		console.log('Send new values to arduino.');
		params['distance'] = query['distance'];
		params['threshold'] = query['threshold'];
		storage.setItem('distance', query['distance']);
		storage.setItem('threshold', query['threshold']);
		var cmd = '1';
		arduinoPort.write(cmd+query['distance']+':'+query['threshold']+'/');
	}

	//Sets the delay before taking shot
	if(query['shotDelay'] != undefined) {
		params['shotDelay'] = query['shotDelay'];
		storage.setItem('shotDelay', query['shotDelay']);
	}

	//Sets the video shot duration in case the mode is set to video.
	if(query['videoDuration'] != undefined) {
		params['videoDuration'] = query['videoDuration'];
		storage.setItem('videoDuration', query['videoDuration']);
	}

	//Sets the number of screens to extract from videos
	if(query['screensCount'] != undefined) {
		params['screensCount'] = query['screensCount'];
		storage.setItem('screensCount', query['screensCount']);
	}

	processRequest(response, query);
}).listen(PORT, function(){
    //Callback triggered when server is successfully listening. Hurray!
    console.log("Server listening on: http://localhost:%s", PORT);
});

	function isEmpty(obj) {
	for(var prop in obj) {
		if(obj.hasOwnProperty(prop)) return false;
	}
	return true;
}

function processRequest(r, p) {
	if(r == undefined) r = httpResponse;
	if(p == undefined) p = {};

	//Get asked file name
	filename = filename.replace(__dirname+'\\', "");
	if(filename.length == 0) filename = 'index.html';

	if(!fs.existsSync(filename)) {
		r.writeHead(404, {"Content-Type": "text/plain"});
		r.write("404 Not Found\n");
		r.end();
		return;
	}
	fs.readFile(filename, "binary", function(err, file) {
		//Define hashmap for extension to header
		var extToHeader = {};
		extToHeader['html'] = 'text/html';
		extToHeader['svg'] = 'image/svg+xml';
		extToHeader['woff2'] = 'font/woff2';

		//Get file's extension
		var ext = filename.replace(/[^.]*\.(.*)/gi, '$1');
		if(extToHeader[ext] == undefined) ext = 'html';

		//Define header
		var headerParams = {};
		headerParams['Content-Type'] = extToHeader[ext];
		if(filename == 'index.html' && !isEmpty(p)) {
			//If index.html, redirect to root to hide GET parameters and
			//prevent from multiple execution on refresh.
			headerParams['Location'] = '/';
			r.writeHead(302, headerParams);
		}else{
			r.writeHead(200, headerParams);
		}
		if(filename == 'index.html') {
			//Display/hide/populate console
			if(consoleValue == '') {
				//remove console if there's nothing to display inside it
				file = file.replace(/<!--CONSOLE_START-->(.|\r|\n)*<!--CONSOLE_END-->/gim, '');
			}else{
				file = file.replace("{CONSOLE_VALUE}", consoleValue);
			}

			//Push back vars from persistent layer to the template.
			//This actually pre-fills the form inputs.
			for(var key in params) {
				file = file.replace('{VAR_'+key+'}', params[key]);
			}
			file = file.replace(new RegExp('{MODE_'+params['currentMode']+'}', 'gi'), ' selected');
			file = file.replace(/\{MODE_[0-9]\}/gi, '');
			file = file.replace(/\{CURRENT_MODE\}/gi, params['currentMode']);
		}
		r.write(file, "binary");
		r.end();

		//Clear console.
		if(filename == 'index.html' && isEmpty(p)) consoleValue = '';
	});
}