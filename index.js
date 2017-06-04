// serverova cast
var express = require('express'); 
var app = express();  
var pouchdb = require('pouchdb');
var http = require('http').Server(app);
var port = process.env.PORT || 3000;

// vyhladanie priecinka client
app.use(express.static('client')); 

// pocuvanie servera na porte 3000
http.listen(port, function(){
	console.log("http server listening on *:" + port);
	console.log("please browse: http://localhost:" + port);
});

// instancia lokalnej databazy
const pdb = new pouchdb("pdb");

// websocket 
var PORT = 5000;
var ws = require("nodejs-websocket");
var connections = [];
var syncHandler;

// vytvorenie ws servera
var server = ws.createServer(function (conn) {
	connections.push(conn);
	// obsluha prijatej spravy z klienta 
	conn.on("text", function (str) { // str - prijata sprava
		var data = JSON.parse(str); // transformacia str na JS objekt
		var message, style;
		var user = data.user;
		// aka akcia ma nastat podla typu prijatej spravy 
		switch (data.type) {
			case "open": // Login
				// pri viacerych kartach v jednom prehliadaci -> [user] (testovanie na jednom PC)
				if (this.currentUser) {
					~this.currentUser.indexOf(user) || this.currentUser.push(user);
				} else {
					this.currentUser = [user];
				}
				// inicializacia replikacie lokalnej (pouchDb) databazy voci vzdialenej (couchDb)
				replication(data.ip || "localhost");
				message = "has been connected";
				style = "info";
				break;
			case "message": // Send
				message = data.message;
				break;
			case "close": // ukoncenie servera
				message =  "has beed disconnected";
				style = "info";
				break;
			case "logout": // Logout
				// ukoncenie replikacie
				syncHandler.cancel();
				message =  "logged off";
				style = "info";
				break;
			case "clear": // Clear data
				clearDb();
				break;
		}
		// obsah str (data.message) sa posle do databazy 
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

// ulozenie spravy v DB a zobrazenie v prehliadaci
function broadcast(user, message, style) {
	// ak style nie je typu info a sync, ulozi do lokalnej DB (automaticka replikacia na vzdialenu DB)
	~["info", "sync"].indexOf(style) || pdb.put({
		_id : new Date().getTime() + "",
		message : message,
		user : user,
		style : style
	});
	// pre vsetky spojenia posli spravu 
	connections.forEach(function(c) {
		c.sendText(JSON.stringify({
			message : message,
			user : user,
			style : style
		}));
	});
}

// vymazanie DB
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
	.catch(e => { //styl zapisu v es6
		console.log('error: ' + e);
	});
}

// replikacia
function replication(ipAddress) {
	// adresa vzdialenej databazy
	const cdb = "http://" + ipAddress + ":5984/cdb";
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
		});
	});

	syncHandler.on('error', e => {
		console.log("error: ", e);
	});

	syncHandler.on('complete', i => {
		console.log("Replication was canceled!");
	});
}