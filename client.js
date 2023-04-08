const ws = require('ws');


let socket = new ws.WebSocket("ws://localhost:4000");


socket.onopen = function (e) {
    console.log("[open] Connection established");
    console.log("Enter a url such as: ")
    console.log("http://localhost:4000/https://stackoverflow.com");
};


socket.onmessage = function (event) {
    console.log(`${event.data}`);
};


socket.onclose = function (event) {
    if (event.wasClean) {
        console.log(`[close] Connection closed cleanly, code=${event.code} reason=${event.reason}`);
    } else {
        console.log('[close] Connection died, code= '+ event.code);
    }
};


socket.onerror = function (error) {
    console.log(`[error] ${error.message}`);
};


const stdin = process.openStdin();


stdin.addListener("data", function (d) {


    var inputCommand = d.toString();


    console.log("Sending to server");
    socket.send(inputCommand);
    console.log("Sent: " + inputCommand);
});
