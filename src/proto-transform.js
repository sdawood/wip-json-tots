/*

 ----------------------------------------------------------------------------
 | qewd-transform-json: Transform JSON using a template                     |
 |                                                                          |
 | Copyright (c) 2016-17 M/Gateway Developments Ltd,                        |
 | Redhill, Surrey UK.                                                      |
 | All rights reserved.                                                     |
 |                                                                          |
 | http://www.mgateway.com                                                  |
 | Email: rtweed@mgateway.com                                               |
 |                                                                          |
 |                                                                          |
 | Licensed under the Apache License, Version 2.0 (the "License");          |
 | you may not use this file except in compliance with the License.         |
 | You may obtain a copy of the License at                                  |
 |                                                                          |
 |     http://www.apache.org/licenses/LICENSE-2.0                           |
 |                                                                          |
 | Unless required by applicable law or agreed to in writing, software      |
 | distributed under the License is distributed on an "AS IS" BASIS,        |
 | WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. |
 | See the License for the specific language governing permissions and      |
 |  limitations under the License.                                          |
 ----------------------------------------------------------------------------

  10 May 2017

  Thanks to Dan Ledgard for fix to recursive use of helper functions

*/

var traverse = require('traverse');

function isNumeric(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
}

var helperFuncs = {
    either: function(value, def) {
        if (value === '') return def;
        return value;
    },
    getDate: function(input) {
        if (!input) return new Date();
        return new Date(input);
    },
    getTime: function(date) {
        if (!date || date === '') return '';
        return new Date(date).getTime();
    },
};

var parentData;

function mapArray(dataArray, templateObj, helpers) {
    if (Array.isArray(dataArray)) {
        var outputArr = [];
        dataArray.forEach(function(obj) {
            var result = transform(templateObj, obj, helpers);
            outputArr.push(result);
        });
        return outputArr;
    }
    else {
        return '';
    }
}

function transform(templateObj, data, helpers = {}) {

    if (!parentData) {
        // do any pre-processing
        if (helpers.init) data = helpers.init(data);
        //console.log('data: ' + JSON.stringify(data, null, 2));
        parentData = data;
    }

    helpers = helpers || {};
    for (var fn in helperFuncs) {
        if (!helpers[fn]) helpers[fn] = helperFuncs[fn];
    }

    function getActualValue(templateRef, data) {
        // vvv this is too naiive to handle a template string with more than one placeholder, e.g. '{{x}}/{{y}}'
        var pieces = templateRef.split("{{");
        var objRef = pieces[1];
        var before = pieces[0];
        pieces = objRef.split("}}");
        objRef = pieces[0];
        var after = pieces[1] || '';
        var fn = new Function('data', 'return data.' + objRef + ';'); //@TODO: this can't handle string attribute names with special characters, e.g. "x.y"
        //console.log('fn: ' + fn);
        //console.log('** data = ' + JSON.stringify(data, null, 2));
        try {
            var result = fn(data);
            //console.log('***** result = ' + result);
            if (typeof result === 'undefined' || result === null) result = '';
            if (typeof result !== 'object' && isNumeric(result) && (before !== '' || after !== '')) {
                result = result.toString();
            }
            if (typeof result === 'string') result = before + result + after;
            return result;
        }
        catch(err) {
            // try using parentData object
            //console.log('** Unable to find input object - try parentData');
            try {
                result = fn(parentData);
                //console.log('***** result = ' + result);
                if (typeof result === 'undefined' || result === null) result = '';
                if (typeof result !== 'object' && isNumeric(result) && (before !== '' || after !== '')) {
                    result = result.toString();
                }
                if (typeof result === 'string') result = before + result + after;
                return result;
            }
            catch(err) {
                //console.log('^^^^^ failed to map');
                return '';
            }
        }
    }

    var outputObj = traverse(templateObj).map(function(node) {
        if (typeof node === 'function') {
            this.update(node(data));
        }

        else if (Array.isArray(node)) {
            // is this a template definition for the array?

            if (node.length === 2 && node[0] && typeof node[0] === 'string' && node[0].indexOf('{{') !== -1) {
                var dataArr = getActualValue(node[0], data);
                if (!Array.isArray(dataArr)) dataArr = []; // ****
                var template = node[1];
                if (template) {
                    var outputArr = mapArray(dataArr, template, helpers);
                    this.update(outputArr);
                }
                else {
                    this.update(dataArr);
                }
            }
        }

        else if (typeof node === 'string') {
            if (node.indexOf('{{') !== -1) {
                this.update(getActualValue(node, data));
                return;
            }

            if (node[0] === '=' && node[1] === '>') {
                var fn = node.split('=>')[1];
                //fn = fn.replace(/ /g,'');
                fn = fn.trim(); // remove leading & trailing spaces
                var pieces = fn.split('(');
                var fnName = pieces[0];
                var argStr = pieces[1].split(')')[0];
                var args = argStr.split(',');
                var argArr = [];
                if (args) {
                    args.forEach(function(arg) {
                        arg = arg.trim();
                        if (arg[0] === '"' || arg[0] === "'") {
                            arg = arg.slice(1, -1);
                        }
                        else {
                            var argx = '{{' + arg + '}}';
                            try {
                                arg = getActualValue(argx, data);
                            }
                            catch(err) {
                                console.error(err);
                            };
                        }
                        argArr.push(arg);
                    });
                }
                try {
                    var result = helpers[fnName](...argArr);
                    if (result === '<!delete>') {
                        this.delete();
                    }
                    else {
                        this.update(result);
                    }
                }
                catch(err) {
                    this.update("Error running: " + fnName + "('" + argArr + "')");
                }
            }
        }
    });
    return outputObj;
}

module.exports = transform;