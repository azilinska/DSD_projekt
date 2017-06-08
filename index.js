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

const pdb = new pouchdb("test_pdb");

//const cdb = new pouchdb('http://localhost:5984/test_cdb');
//const cdb = new pouchdb('http://192.168.1.13:5984/test_cdb');

// local and remote db synchronization
// socket part
var PORT = 5000;
var ws = require("nodejs-websocket");
var connections = [];
var syncHandler;

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
	});
}).listen(PORT);
console.log('websocket server listening on ' + PORT);

function broadcast(user, message, style) {
	~["info", "sync"].indexOf(style) || pdb.put({
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
	pdb.allDocs()//
	.then(r => {
		var docs = r.rows.map(function(row){ 
			return { 
				_id: row.id, 
				_rev: row._rev || row.value.rev,
				_deleted: true 
			}; 
		});
		return (docs && docs.length) && pdb.bulkDocs(docs)//
		.then(() => {
			console.log("Documents deleted Successfully");
		});
	})//
	.catch(e => {
		console.log('error: ' + e);
	});
}

function _hDbReplication(ipAddress) {
	const cdb = "http://" + ipAddress + ":5984/test_cdb";
	let opts = {
		live: true,
	  	retry: true
	};
	syncHandler = pdb.sync(cdb, opts);

	console.log("Replication to remote DB: ", cdb);

	syncHandler.on("change", evt => {
		let docs = evt.change && evt.change.docs;
		if (!docs || !docs.length) {
			return;
		}
		docs.forEach(doc => {
			if (doc._deleted || ~server.currentUser.indexOf(doc.user)) {
				return;
			}
			broadcast(doc.user, doc.message, "sync");
			//console.log("Changes from repl:", doc);
		});
	});

	syncHandler.on('error', e => {
		console.log("error: ", e);
	});

	syncHandler.on('complete', i => {
		console.log("Replication was canceled!");
	});
}