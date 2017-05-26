/*globals $:false,JSON:false,Vue:true */

var app = new Vue({
  el: '#app',
  data: {
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
        onSubmit : function() {
            app.socket.send(JSON.stringify({
                type : "message",
                message : app.message,
                user : app.user
            }));
            app.message = "";
            
        },
        onLogin : function() {
        	if (!app.user) {
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
