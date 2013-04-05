/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50, node: true */
/*global $, define */

(function () {
    "use strict";

    var handles = {};
    
    var servers = [];
    
    var serverStartTimeout = setTimeout(function () {
        console.error("[%d] timeout while waiting for server initialization", process.pid);
    }, 5000);
    
    function createStaticServer(staticPath) {
        var path = require("path"),
            connect = require("connect");

        var resolvedPath = path.resolve(".", staticPath);

        var app = connect();
        if (process.stdout.isTTY) {
            app.use(connect.logger('dev'));
        } else {
            app.use(connect.logger('tiny'));
        }
        app.use(connect["static"](resolvedPath));
        app.use(connect.directory(resolvedPath));

        return app;
    }
    
    function createAppServer(appPath) {
        var path = require("path");
        var resolvedPath = path.resolve(".", appPath);
        return require(resolvedPath);
    }
    
    function createVhostServer(vhosts) {
        var connect = require("connect");
        var app = connect();
        vhosts.forEach(function (vhost) {
            var vApp = null;

            if (vhost["static"]) {
                vApp = createStaticServer(vhost["static"]);
            } else if (vhost.app) {
                vApp = createAppServer(vhost.app);
            }
            
            if (vApp) {
                vhost.domains.forEach(function (domain) {
                    app.use(connect.vhost(domain, vApp));
                });
            }
        });
        return app;
    }

    function initServers(servers) {
        clearTimeout(serverStartTimeout);
        servers.forEach(function (serverConf) {
            var app = null;
            if (serverConf.vhosts) {
                app = createVhostServer(serverConf.vhosts);
            } else if (serverConf["static"]) {
                app = createStaticServer(serverConf["static"]);
            } else if (serverConf.app) {
                app = createAppServer(serverConf.app);
            }

            if (app) {
                var server = require("http").createServer(app);
                servers.push(server);
                var family = serverConf.family || 4;
                var key = [serverConf.ip, serverConf.port, family].join(":");
                var handle = handles[key];
                if (handle) {
                    server.listen(handle, function () {
                        console.log("[%d] server %s listening on %s:%d", process.pid, serverConf.name, serverConf.ip, serverConf.port);
                        process.emit("serving");
                    });
                } else {
                    console.error("[%d] no handle for server %s on %s:%d", process.pid, serverConf.name, serverConf.ip, serverConf.port);
                }
            }
        });
    }
    
    function shutdown() {
        servers.forEach(function (s) {
            s.close();
        });
        process.exit(0);
    }
    
    console.log("[%d] worker started", process.pid);

    process.on("message", function (msg, handle) {
        if (msg.servers) {
            process.nextTick(function () { initServers(msg.servers); });
        } else if (msg.handle && handle) {
            handles[msg.handle] = handle;
        }
    });
    
    process.on("disconnect", function () {
        console.log("[%d] disconnect event from master, exiting", process.pid);
        shutdown();
    });
    
    process.on("SIGTERM", function () {
        console.log("[%d] received SIGTERM, exiting", process.pid);
        shutdown();
    });

    process.on("SIGINT", function () {
        console.log("[%d] received SIGINT, exiting", process.pid);
        shutdown();
    });
    
}());
