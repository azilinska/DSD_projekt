// 

var app = new Vue({ //framework vue.js
  el: '#app', // prvok viazany na div app v html 
  data: { //v-model v html
    user : "",
    ip : "",
    isLogged : false,
    isOnline : false,
	loginText: 'Login',
	logoutText: 'Logout',
    messages: [],
    message : "",
    socket : null
  },
  methods : 
    {
		// Send
        onSubmit : function() {
            app.socket.send(JSON.stringify({
                type : "message",
                message : app.message,
                user : app.user
            }));
            app.message = "";
            
        },
		
		// Login/Logout
        onLogin : function() {
        	if (!app.user) { // ak nie je zadany user 
        		return;
        	}
            if (app.socket && app.socket.readyState == 1) {
        		app.socket.send(JSON.stringify({
	                type : app.isOnline ? "logout" : "open",
	                ip : app.ip,
	                user : app.user
	            }));
                app.isOnline = !app.isOnline;
            } else {
                app.socket = createSocket();
                app.socket.onopen = function() {
                    app.isLogged = true;
                    app.isOnline = true;
                    app.socket.send(JSON.stringify({
                        type : "open",
                        ip : app.ip,
                        user : app.user
                    }));
                };
                app.socket.onclose = function(evt) {
                    app.isLogged = false;
                };
                app.socket.onmessage = function(evt) {
                    var data = JSON.parse(evt.data);
                    app.messages.unshift(data);
                };
            }
        },
		
		// Clear Data
        onClear : function() {
        	app.messages = [];
        	app.socket && app.socket.send(JSON.stringify({
                type : "clear",
                user : app.user
            }));
        }
    }
});

function createSocket() {
    return new WebSocket("ws://"+window.location.hostname+":5000");
}
