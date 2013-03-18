/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50, node: true */
/*global $, define */

(function () {
    "use strict";

    /**
     * TODOs:
     *   - Add minimum worker uptime
     *   - Add check to make sure some workers actually launched
     *   - Add support for worker retirement
     *   - Add support for HTTPS
     */
    module.exports = function (config) {
        
        var handles = {};
        
        var children = [];
        
        var shuttingDown = false;
        
        function createHandles() {
            var net = require("net");
            config.servers.forEach(function (serverConf) {
                var family = serverConf.family || 4;
                var args = [serverConf.ip, serverConf.port, family];
                var key = args.join(":");
                var handle = net._createServerHandle.apply(net, args);
                handles[key] = handle;
            });
        }
       
        function initWorker(emitterFunction) {
            var handleKey;
            for (handleKey in handles) {
                if (handles.hasOwnProperty(handleKey)) {
                    emitterFunction({"handle" : handleKey}, handles[handleKey]);
                }
            }
            emitterFunction({servers : config.servers});
        }
        
        function launchChildren(number) {
            function createChildRelauncherFunction(oldChild) {
                return function (code, signal) {
                    var i = children.indexOf(oldChild);
                    if (i >= 0) {
                        children.splice(i, 1);
                    }
    
                    console.log("[launcher] child %d exited with code %d, and signal %d", oldChild.pid, code, signal);
                    process.nextTick(function () {
                        if (!shuttingDown) {
                            launchChildren(1);
                        }
                    });
                };
            }
            
            console.log("[launcher] spawning %d child process(es)", number);
            var child_process = require("child_process");
            var i;
            for (i = 0; i < number; i++) {
                var child = child_process.fork("./worker.js");
                children.push(child);
                child.on("exit", createChildRelauncherFunction(child));
                initWorker(child.send.bind(child));
            }
        }
    
        function shutdown(exitCode) {
            shuttingDown = true;
            if (config.children) {
                children.forEach(function (child) {
                    console.log("[launcher] killing child %d", child.pid);
                    child.kill("SIGTERM");
                });
            }
            process.exit(exitCode);
        }
    
    
        if (config.children) {
            // If we don't have children, then the worker running
            // in this process will install SIGTERM/SIGINT handlers
            process.on("SIGTERM", function () {
                console.log("[launcher] received SIGTERM, exiting");
                shutdown();
            });
        
            process.on("SIGINT", function () {
                console.log("[launcher] received SIGINT, exiting");
                shutdown();
            });
        }
            
        // Get resources
        try {
            createHandles();
            // TODO: Read key files
        } catch (resourceException) {
            console.error("[launcher] exception getting resources", resourceException);
            shutdown(-1);
        }
    
        try {
            // Drop priviledges
            if (config.setgid) {
                process.setgid(config.setgid);
            }
            if (config.setuid) {
                process.setuid(config.setuid);
            }
        } catch (setUidException) {
            console.error("[launcher] exception setting uid/gid", setUidException);
            shutdown(-2);
        }
            
        // Start worker(s)
        if (config.children) {
            launchChildren(config.children);
        } else { // run in this process
            require("./worker.js");
            initWorker(function (msg, handle) { process.emit("message", msg, handle); });
        }
    };
    
}());