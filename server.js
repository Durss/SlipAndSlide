//GOPRO WiFi commands documentation : 
// https://github.com/KonradIT/goprowifihack/blob/master/WiFi-Commands.mkdn
//Reset your gopro wifi :
// http://trendblog.net/reset-your-gopro-wifi-password-in-less-than-2-minutes/

var gopro_password = 'your_gopro_wifi_password_here';

var http		= require('http'),
	serialport 	= require('serialport'),
    url			= require("url"),
    path		= require("path"),
    fs			= require("fs"),
    request		= require('request'),
    storage		= require('node-persist');
	SerialPort	= serialport.SerialPort;

storage.initSync();

const PORT=8080;
var timeoutStop;
var params = {};
	params['distance']		= storage.getItem("distance") || 30;
	params['threshold']		= storage.getItem("threshold") || 200;
	params['shotDelay']		= storage.getItem("shotDelay") || 500;
	params['videoDuration']	= storage.getItem("videoDuration") || 10000;
	params['currentMode']	= storage.getItem("currentMode") || '00';

if(process.argv.length < 3) {
	console.error('Missing port name argument (ex: COM3)');
	process.exit(1);
}

// get port name from the command line:
var portName = process.argv[2];
var arduinoPort = new SerialPort(portName, {
   baudRate: 9600,
   // look for return and newline at the end of each data packet:
   parser: serialport.parsers.readline("\r\n")
 });


console.log("Starting gopro...");
request.get('http://10.5.5.9/bacpac/PW?t='+gopro_password+'&p=%01', function (error, response, body) {
	if (!error && response.statusCode == 200) {
		console.log("Gopro started !");
		console.log("Setting video mode...");
		request.get('http://10.5.5.9/camera/CM?t='+gopro_password+'&p=%' + params['currentMode'], function (error, response, body) {
			console.log("Video mode set !");
			if (!error && response.statusCode == 200) {
				console.log("Disable auto power off... (not working with gopro hero 3 white)");
				request.get('http://10.5.5.9/camera/AO?t='+gopro_password+'&p=%00', function (error, response, body) {
					if (!error && response.statusCode == 200) {
						console.log("Auto power off disabled");
						console.log(body);
					}
				});
			}
		});
	}
});

arduinoPort.on('data', onSerialData);

var consoleValue = '';
function onSerialData(data) {
	console.log("::SERIAL DATA ::");
	console.log(data);
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
			request.get('http://10.5.5.9/bacpac/SH?t='+gopro_password+'&p=%01', function (error, response, body) {
				if (!error && response.statusCode == 200) {
					console.log(body);
				}
				//If video mode, stop recording after duration
				if(params['currentMode'] == '00') {
					clearTimeout(timeoutStop);
					timeoutStop = setTimeout(function(){
						//Stop rectoding
						console.log('Stop video recording.');
						request.get('http://10.5.5.9/bacpac/SH?t='+gopro_password+'&p=%00',
							function (error, response, body) {},
							function(e) { console.log(e); });
					}, params['videoDuration']);
				}
			}, function(e) {
				console.log(e);
			})}
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
		request.get('http://10.5.5.9/bacpac/PW?t='+gopro_password+'&p=%'+query['power'],
			function (error, response, body) {console.log(body)},
			function(e) { console.log(e); });
	}

	//Sets the capture mode
	if(query['setMode'] != undefined) {
		console.log('Set mode ' + query['setMode']);
		params['currentMode'] = query['setMode'];
		storage.setItem('currentMode', query['setMode']);
		request.get('http://10.5.5.9/camera/CM?t='+gopro_password+'&p=%'+query['setMode'],
			function (error, response, body) {},
			function(e) { console.log(e); });
	}

	//Deletes all medias from gopro
	if(query['deleteAll'] != undefined) {
		console.log('Delete all files from gopro.');
		request.get('http://10.5.5.9/camera/DA?t='+gopro_password,
			function (error, response, body) {},
			function(e) { console.log(e); });
	}

	//Locates the gopro (makes it beep for 1min)
	if(query['locateGoPro'] != undefined) {
		console.log('Locate gopro.');
		request.get('http://10.5.5.9/camera/LL?t='+gopro_password+'&p=%01',
			function (error, response, body) {},
			function(e) { console.log(e); });
		setTimeout(function() {
			console.log('Stop gopro location.');
			request.get('http://10.5.5.9/camera/LL?t='+gopro_password+'&p=%00',
				function (error, response, body) {},
				function(e) { console.log(e); });
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
			file = file.replace('{MODE_'+params['currentMode']+'}', ' selected');
			file = file.replace(/\{MODE_[0-9]{2}\}/gi, '');
		}
		r.write(file, "binary");
		r.end();

		//Clear console.
		if(filename == 'index.html' && isEmpty(p)) consoleValue = '';
	});
}