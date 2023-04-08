 const http = require('http');
const https = require('https');
const url = require('url');
const SimpleHashTable = require('simple-hashtable');
const ws = require('ws');
const host = 'localhost';
const port = 4000;
const NodeCache = require("node-cache");
const { time } = require('console');


// ten min expiry in cache
var cache = new NodeCache({ stdTTL: 600, checkperiod: 600 });


// list of blocked sites
var blockedSites = new SimpleHashTable();


// Constants for timing
const NS_PER_SEC = 1e9
const MS_PER_NS = 1e6


var startTime = process.hrtime();
var endTime = process.hrtime();




// this function will handle requests http or https (only)
const onReq = function (request, response, socket, ws) {


    startTime = process.hrtime();


    // parse the url for a server request or a websocket request
    if (socket) {
        var current = url.parse(request.toString('utf8'), true);
    } else {
        var current = url.parse(request.url.substring(1), true);
    }


    console.log("Current Request: ", current.protocol + "//" + current.host);


    var proxy;


    //  ensure it is a proper request
    if (current.path != 'favicon.ico' && current.host != 'assets' && current.host != null) {


        // get url from cache
        var hit = cache.get(current.href);


        // ensures the requested url is not blocked
        if (blockedSites.containsKey(current.hostname)) {
            if (socket) {
                ws.send("This site is blocked :(");
            } else {
                response.write("This site is blocked :(");
                response.end();
            }
        } else {


            // if there is nothing in the cache then send a http or https request
            if (hit == undefined || hit == null) {


                if (current.protocol == "http:") {


                    proxy = http.get(current.href, (res) => responseHandler(current.href, res, response, socket, ws));


                } else if (current.protocol == "https:") {


                    proxy = https.get(current.href, (res) => responseHandler(current.href, res, response, socket, ws));


                } else {
                    if (!socket) {
                        response.write('Invalid request try a valid request such as:\nhttp://localhost:4000/https://www.tcd.ie');
                        response.end();
                    } else {
                        ws.send('Invalid request try a valid request such as:\nhttps://www.tcd.ie');
                    }
                }
            } else {
                if (!hit.err) {


                    var cachedExpiryDate = Date.parse(hit.expiryDate);
                    var responseExpiryDate = new Date();


                    // check hit from cache is still valid
                    if (cachedExpiryDate > responseExpiryDate) {


                        console.log("Hit in cache :)");
                        if (!socket) {
                            response.write(hit.page);
                            response.end();
                        } else {
                            ws.send(hit.page);
                        }
                        endTime = process.hrtime();


                        const timing = processTime(startTime, endTime);


                        var responseSizeKB = Buffer.byteLength(hit.page, 'utf8') / 1024;
                        console.log("Size of Response ", responseSizeKB);


                        // response size in KBs and timing is multiplied by .001 to convert from ms to seconds
                        var bandwidth = (responseSizeKB / (timing * 0.001));
                        console.log("Bandwidth for response: ", bandwidth, "KB/s");
                    } else {


                        console.log("Cached data has expired :(");
                        if (current.protocol == "http:") {


                            proxy = http.get(current.href, (res) => responseHandler(current.href, res, response, socket, ws));


                        } else if (current.protocol == "https:") {


                            proxy = https.get(current.href, (res) => responseHandler(current.href, res, response, socket, ws));


                        } else {
                            if (!socket) {
                                response.write('Invalid request try a valid request such as:\nhttp://localhost:4000/https://www.tcd.ie');
                                response.end();
                            } else {
                                ws.send('Invalid request try a valid request such as:\nhttps://www.tcd.ie');
                            }
                        }
                    }
                } else {
                    console.log("Error in cache");
                }
            }
        }
    } else {
        if (!socket) {
            response.end();
        }
    }
};


const processTime = function (startTime, endTime) {
    var time = -1;
    if (endTime != undefined) {
        const secondDiff = endTime[0] - startTime[0];
        const nanoSecondDiff = endTime[1] - startTime[1];
        const diffInNanoSecond = secondDiff * NS_PER_SEC + nanoSecondDiff;
        time = diffInNanoSecond / MS_PER_NS;


        console.log("Time for Request: " + time + "ms");
    }
    return time;
}


// handles all responses
const responseHandler = function (current, res, response, socket, ws) {


    const { statusCode } = res;


    console.log(res.headers['expires']);


    // get the expiry of the response, otherwise set it to ten mins from current time
    var expiry = res.headers['expires'];
    if (expiry == undefined || expiry == -1) {
        expiry = new Date();
        expiry = new Date(expiry.getTime() + 10 * 60000);
    }


    let error;
    // Any 2xx status code signals a successful response but
    // here we're only checking for 200.
    if (statusCode !== 200) {
        error = new Error('Request Failed.\n' +
            `Status Code: ${statusCode}`);
    }


    if (error) {
        console.error(error.message);
        // Consume response data to free up memory
        res.resume();
        return;
    }


    let rawData = '';


    res.setEncoding('utf8');


    console.log("url not found in cache");


    console.log("Gathering chunks of data !");
    res.on('data', (chunk) => { rawData += chunk; });


    // Writing back to user
    res.on('end', () => {
        try {
            if (!socket) {
                response.write(rawData);
                response.end();
            } else {
                ws.send(rawData);
            }
        } catch (e) {
            console.error(e.message);
        }


        console.log(expiry);


        // create cache objext
        data = {
            expiryDate: expiry,
            page: rawData
        }


        // this section will cache the current url
        let set = cache.set(current, data, 300);


        if (set) {
            console.log("Set In Cache!\n");
        } else {
            console.log("Not Set In Cache!\n");
        }


        endTime = process.hrtime();


        const timing = processTime(startTime, endTime);


        var responseSizeKB = Buffer.byteLength(rawData, 'utf8') / 1024;
        console.log("Size of Response ", responseSizeKB);


        // response size in KBs and timing is multiplied by .001 to convert from ms to seconds
        var bandwidth = (responseSizeKB / (timing * 0.001));
        console.log("Bandwidth for response: ", bandwidth, "KB/s");
    });


};


const stdin = process.openStdin();


// this function listens for input from the command line (for blocking urls)
/* Command Structure
 *  block   www.example.com
 *  unblock www.example.com
*/
stdin.addListener("data", function (d) {


    var inputCommand = d.toString();
    var commandArray = inputCommand.split(" ");


    if (commandArray[0] == "block") {
        if (blockedSites.containsKey(commandArray[1].trim())) {
            console.log("This URL is already blocked :)");
        } else {
            blockedSites.put(commandArray[1].trim());
            console.log("You are blocking: [" + commandArray[1].trim() + "]");
        }
    } else if (commandArray[0] == "unblock") {
        if (!blockedSites.containsKey(commandArray[1].trim())) {
            console.log("This URL is not blocked ?");
        } else {
            blockedSites.remove(commandArray[1].trim());
            console.log("You are unblocking: [" + commandArray[1].trim() + "] :)");
        }
    } else {
        console.log("Unknown command");
    }


});


const server = http.createServer(onReq);


server.listen(port, host, () => {
    console.log(`Welcome to the management console :)\nServer is running on http://${host}:${port}! \nGo to http://localhost:4000/`);
    console.log(`You can block or unblock a url!\n`);
});


// WebSocket server
var wsServer = new ws.Server({ server });


// handles all websocket connections
wsServer.on('connection', (ws) => {
    console.log("Connected");


    ws.on('message', function (message) {
        console.log(message);
        wsOnReq(message, ws);
    });


    ws.on('close', function () {


    });
});




// this function will handle requests from WebSocket connections
const wsOnReq = function (request, ws) {


    console.log("Received WebSocket request for: " + request);


    onReq(request, '', true, ws);


};



