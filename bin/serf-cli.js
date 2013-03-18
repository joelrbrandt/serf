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
    
    var argv = optimist["default"]({
        "ip": "127.0.0.1",
        "port": "8080",
        "name": "noname",
        "children": 0
    }).argv;
            
    if (argv.config) {
        config = require(path.resolve(process.cwd(), argv.config));
    } else {
        config = {
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
