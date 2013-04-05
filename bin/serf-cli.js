#!/usr/bin/env node

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50, node: true */
/*global $, define */

(function () {
    "use strict";
    
    var launcher = require("../lib/launcher"),
        optimist = require("optimist"),
        path = require("path"),
        fs = require("fs");

    var config = {};
    
    // TODO: "open" option only works on mac in single-process mode.
    // Should notify when those conditions aren't met that the
    // option is ignored. Also, should have usage info.
    
    var argv = optimist["default"]({
        "i": "127.0.0.1",
        "p": "8080",
        "n": "noname",
        "c": 0,
        "o": false
    }).alias({
        "i": "ip",
        "p": "port",
        "n": "name",
        "c": "children",
        "o": "open",
    }).argv;
            
    if (argv.config) {
        config = require(path.resolve(process.cwd(), argv.config));
    } else {
        config = {
            open : argv.open,
            children : argv.children,
            servers : [ {
                ip: argv.ip,
                port: argv.port,
                name: argv.name
            } ]
        };
        
        var unresolvedPath = argv.path || argv._[0] || process.cwd();
        var resolvedPath = path.resolve(process.cwd(), unresolvedPath);
        console.log("Resolved path: '%s'", resolvedPath);
        var stats = fs.statSync(resolvedPath);
        if (stats.isDirectory()) {
            config.servers[0]["static"] = resolvedPath;
        } else if (stats.isFile()) {
            config.servers[0].app = resolvedPath;
        }
    }
    
    console.log("[serf] using config:\n%s", JSON.stringify(config, null, 2));
    
    launcher(config);
}());
