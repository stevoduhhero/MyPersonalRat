var port = 8002;
//web server requires
var chalk = require('chalk');
var compression = require('compression');
var express = require('express');
var http = require('http');
var logger = require('morgan');
var path = require('path');
//normal requires
var socketio = require('socket.io');
var fs = require('fs');
var exec = require('child_process').exec;
var isWindows = /^win/.test(process.platform);
var os = require('os');
//get ipv4
var interfaces = os.networkInterfaces();
var addresses = [];
for (var k in interfaces) {
    for (var k2 in interfaces[k]) {
        var address = interfaces[k][k2];
        if (address.family === 'IPv4' && !address.internal) {
            addresses.push(address.address);
        }
    }
}
fs.writeFileSync(__dirname + '/portHost.js', 'var host = "' + addresses[0] + '";var port = ' + port + ';');
console.log("\nVisit the rat @ \n\thttp://" + addresses[0] + ":" + port);

//initialize web server
var web = express();
var server = http.Server(web);
web.use(compression());
/*** Serve the static files. */
web.use(express.static(path.join(__dirname, "./")));
/*** GET Home page. */
web.get('/', function(req, res) {res.sendFile(path.join(__dirname, './index.html'));});
/*** listen */
web.set('port', port);
server.listen(web.get('port'), function() {
	var env = '\n[' + chalk.green(web.get('env')) + ']';
	var port = chalk.magenta(web.get('port'));
	console.log(env + ' Listening on port ' + port + '...\n');
});

//settings
var magnification = 1;
var resolution = {x: 0, y: 0};
var minRes = {
	//client minimum res
	//minimum resolution to fit on iphone6plus with lowest quality on chrome
	x: 601,
	y: 338
};
var quality = 2;
var pictureResolution = {
	x: minRes.x * quality,
	y: minRes.y * quality
};
var screenResolutionCmd = "xdpyinfo | grep 'dimensions:'";
if (isWindows) screenResolutionCmd = "wmic desktopmonitor get screenheight, screenwidth";
var actualSize = exec(screenResolutionCmd, function(error, stdout, stderr) {
	var resolutionString = stdout;
	if (isWindows) {
		resolutionString = resolutionString.toLowerCase().split('screenwidth')[1].trim().split('\n')[0].replace(/[^.0-9]+/g, ' ').trim().split(' ');
	} else {
		resolutionString = resolutionString.split('dimensions:')[1].split('pixels')[0].trim().split('x');
	}
	resolution.x = Number(resolutionString[0]);
	resolution.y = Number(resolutionString[1]);
	magnification = resolution.y / pictureResolution.y
});

//app
function User(socket) {
	var user = this;
	socket.userId = app.userCount;
	user.socket = socket;
	user.userId = app.userCount;
	app.userCount++;
	app.users[app.userCount] = user;
	return user;
}
User.prototype.emit = function(event, data) {
	var obj = data;
	if (typeof obj !== "object") obj = {data: data};
	obj.event = event;
	this.socket.emit('e', obj);
};
var app = {
	convertPixels: function(px) {
		px.x = px.x * magnification;
		px.y = px.y * magnification;
		return px;
	},
	t: function() {return (new Date() / 1);},
	users: {},
	userCount: 0,
	newScreenshot: function() {
		var cmd = "import -window root -resize " + pictureResolution.x + "x" + pictureResolution.y + " " + __dirname + "/screenshot.jpg";
		if (isWindows) cmd = "screeny -encoder jpeg -filename screenshot.jpg -quality 100 -resize " + Math.floor(pictureResolution.y / resolution.y * 100);
		exec(cmd, function() {
			for (var i in app.users) app.users[i].emit('update');
		});
	},
	events: {
		key: function(data) {
			var shell = "";
			for (var i in data.keys) {
				var key = data.keys[i];
				var keyOrStr = "key";
				if (key.length === 1) keyOrStr = "str";
				if (isWindows) {
					var xte2nircmd = {
						"Return": "enter",
						" ": "spc",
						".": "period",
						",": "comma",
						"=": "plus",
						"+": "add",
						"-": "minus",
						"	": "tab",
						"*": "multiply",
						"/": "divide",
						"?": "shift+0xBF",
						"<": "shift+0xBC",
						">": "shift+0xBE",
						"'": "0xDE",
						'"': "shift+0xDE",
						";": "0xBA",
						":": "shift+0xBA",
						"\\": "0xDC",
						"|": "shift+0xDC",
						"]": "0xDD",
						"}": "shift+0xDD",
						"[": "0xDB",
						"{": "shift+0xDB",
						")": "shift+0",
						"(": "shift+9",
						"*": "shift+8",
						"&": "shift+7",
						"^": "shift+6",
						"%": "shift+5",
						"$": "shift+4",
						"#": "shift+3",
						"@": "shift+2",
						"!": "shift+1",
						"`": "0xC0",
						"~": "shift+0xC0"
					};
					if (xte2nircmd[key]) key = xte2nircmd[key];
					//cant find underscore____ keycode
					shell += "nircmd sendkeypress " + key + "\n";
				} else shell += "xte '" + keyOrStr + " " + key + "'\n";
			}
			exec(shell, function() {
				app.newScreenshot();
			});
		},
		mousemove: function(data) {
			data = app.convertPixels(data);
			var shell = "xte 'mousemove " + Math.round(data.x) + " " + Math.round(data.y) + "'";
			if (isWindows) shell = "nircmd setcursor " + Math.round(data.x) + " " + Math.round(data.y);
			exec(shell, function() {
				app.newScreenshot();
			});
		},
		mousedown: function(data) {
			var shell = "";
			if (data.x) {
				data = app.convertPixels(data);
				if (isWindows) {
					shell += "nircmd setcursor " + Math.round(data.x) + " " + Math.round(data.y) + "\n";
				} else shell += "xte 'mousemove " + Math.round(data.x) + " " + Math.round(data.y) + "'\n";
			}
			if (isWindows) {
				shell += "nircmd sendmouse left down\n";
			} else shell += "xte 'mousedown 1'\n";
			exec(shell, function() {
				app.newScreenshot();
			});
		},
		mouseup: function(data) {
			var shell = "";
			if (data.x) {
				data = app.convertPixels(data);
				if (isWindows) {
					shell += "nircmd setcursor " + Math.round(data.x) + " " + Math.round(data.y) + "\n";
				} else shell += "xte 'mousemove " + Math.round(data.x) + " " + Math.round(data.y) + "'\n";
			}
			if (isWindows) {
				shell += "nircmd sendmouse left up\n";
			} else shell += "xte 'mouseup 1'\n";
			exec(shell, function() {
				app.newScreenshot();
			});
		},
		rightClick: function(socket, data) {
			var shell = "";
			if (data.x) {
				data = app.convertPixels(data);
				if (isWindows) {
					shell += "nircmd setcursor " + Math.round(data.x) + " " + Math.round(data.y) + "\n";
				} else shell += "xte 'mousemove " + Math.round(data.x) + " " + Math.round(data.y) + "'\n";
			}
			if (isWindows) {
				shell += "nircmd sendmouse right click\n";
			} else shell += "xte 'mouseclick 3'\n";
			exec(shell, function() {
				app.newScreenshot();
			});
		},
		leftClick: function(data) {
			var shell = "";
			if (data.x) {
				data = app.convertPixels(data);
				if (isWindows) {
					shell += "nircmd setcursor " + Math.round(data.x) + " " + Math.round(data.y) + "\n";
				} else shell += "xte 'mousemove " + Math.round(data.x) + " " + Math.round(data.y) + "'\n";
			}
			if (isWindows) {
				shell += "nircmd sendmouse left click\n";
			} else {
				shell += "xte 'mousedown 1'\n";
				shell += "xte 'mouseup 1'\n";
			}
			exec(shell, function() {
				app.newScreenshot();
			});
		}
	},
};

//initialize socket.io
var io = socketio(server);
io.sockets.on('connection', function (socket) {
	//new socket
	new User(socket);
	socket.on('disconnect', function () {
		delete app.users[socket.userId];
	});
	socket.on('e', function(data) {
		var event = data.event;
		console.log(event);
		if (app.events[event]) app.events[event](data, socket);
	});
});
app.newScreenshot();
