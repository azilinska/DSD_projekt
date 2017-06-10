/*globals __dirname:false,JSON:false */

// web part
var express = require('express');
var app = express();
var pouchdb = require('pouchdb');
var http = require('http').Server(app);
var port = process.env.PORT || 3000;

app.use(express.static('client'));

http.listen(port, function(){
	console.log("http server listening on *:" + port);
	console.log("please browse: http://localhost:" + port);
});

var localCDB = new pouchdb("http://localhost:5984/test_cdb");

// local and remote db synchronization
// socket part
var PORT = 5000;
var ws = require("nodejs-websocket");
var connections = [];
var syncHandler;
var changeHandler;

var server = ws.createServer(function (conn) {
	connections.push(conn);
	conn.on("text", function (str) {
		var data = JSON.parse(str);

		var message, style;
		var user = data.user;
		switch (data.type) {
			case "open":
				// array for more users on one connection (tested on localhost multiple client)
				if (this.currentUser) {
					~this.currentUser.indexOf(user) || this.currentUser.push(user);
				} else {
					this.currentUser = [user];
				}
				_hDbReplication(data.ip || "localhost");
				message = "has been connected";
				style = "info";
				break;
			case "message":
				message = data.message;
				break;
			case "close":
				message =  "has beed disconnected";
				style = "info";
				break;
			case "logout":
				syncHandler.cancel();
				changeHandler.cancel();
				message =  "logged off";
				style = "info";
				break;
			case "clear":
				clearDb();
				break;
			case "typing":
				message = "is typing";
				style = "info";
				break;
		}

		message && broadcast(user, message, style);
	}.bind(this));
	conn.on("error", function() {
		console.log(arguments);
	});
	conn.on("close", function (/*code, reason*/) {
		var idx = connections.indexOf(conn);
		~idx && connections.splice(idx, 1);
		console.log("Connection closed");
		broadcast(null, "Client closed connection", "info");
		syncHandler.cancel();
		changeHandler.cancel();
	});
}).listen(PORT);
console.log('websocket server listening on ' + PORT);

function broadcast(user, message, style) {
	~["info", "sync"].indexOf(style) || localCDB.put({
		_id : new Date().getTime() + "",
		message : message,
		user : user,
		style : style
	});
	connections.forEach(function(c) {
		c.sendText(JSON.stringify({
			message : message,
			user : user,
			style : style
		}));
	});
}

function clearDb() {
	localCDB.allDocs()//
	.then(r => {
		var docs = r.rows.map(function(row){ 
			return { 
				_id: row.id, 
				_rev: row._rev || row.value.rev,
				_deleted: true 
			}; 
		});
		return (docs && docs.length) && localCDB.bulkDocs(docs)//
		.then(() => {
			console.log("Documents deleted Successfully");
		});
	})//
	.catch(e => {
		console.log('error: ' + e);
	});
}

function _hDbReplication(ipAddress) {
	let remoteAddress = "http://" + ipAddress + ":5984/test_cdb";
	let remoteCDB = new pouchdb(remoteAddress);

	changeHandler = localCDB.changes({
		live: true,
		since: 'now',
		include_docs: true
	})//
	.on('change', evt => {
		let d = evt.doc;
		if (!d || d._deleted || ~server.currentUser.indexOf(d.user)) {
			return;
		}
		broadcast(d.user, d.message, "sync");
	});

	syncHandler = localCDB.replicate.to(remoteCDB, {
		live: true,
		retry: true
	});

	console.log("Replication to remote DB:", remoteAddress);

	syncHandler.on('error', e => {
		console.log("error: ", e);
	});

	syncHandler.on('complete', i => {
		console.log("Replication was canceled!");
	});
}