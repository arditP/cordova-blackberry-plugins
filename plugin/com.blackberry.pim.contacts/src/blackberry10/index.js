/*
 * Copyright 2012 Research In Motion Limited.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var pimContacts,
    //_event = require("../../lib/event"),
    _utils = require("../../lib/utils"),
    config = require("../../lib/config"),
    contactUtils = require("./contactUtils"),
    contactConsts = require("./contactConsts"),
    ContactError = require("./ContactError"),
    ContactPickerOptions = require("./ContactPickerOptions"),
    PERMISSION_DENIED_MSG = "Permission denied";

function checkPermission(/*success, eventId*/ pluginResult) {
    if (!_utils.hasPermission(config, "access_pimdomain_contacts")) {
/*
        _event.trigger(eventId, {
            "result": escape(JSON.stringify({
                "_success": false,
                "code": ContactError.PERMISSION_DENIED_ERROR
            }))
        });
*/
//        success();
        pluginResult.callbackError({
            "result": escape(JSON.stringify({
                "_success": false,
                "code": ContactError.PERMISSION_DENIED_ERROR
            }))
        });
        return false;
    }

    return true;
}

function onChildCardClosed(cb) {
    var application = window.qnx.webplatform.getApplication(),
        result = {},
        kindAttributeMap = contactConsts.getKindAttributeMap(),
        subKindAttributeMap = contactConsts.getSubKindAttributeMap(),
        callback = function (info) {
            application.invocation.removeEventListener("childCardClosed", callback);

            if (info.reason === "cancel") {
                cb(undefined, "cancel");
            } else if (info.reason === "contactSelected") {
                result.contactId = info.data;
                cb(result, "done");
            } else if (info.reason === "contactsSelected") {
                info.data = info.data.split("\n");

                info.data.forEach(function (line) {
                    if (line.match("^selectedContacts:json:")) {
                        result.contactIds = JSON.parse(line.slice(22));
                        result.contactIds = result.contactIds.map(function (contactId) {
                                                return JSON.stringify(contactId);
                                            });
                    }
                });

                cb(result, "done");
            } else if (info.reason === "attributeSelected") {
                info.data = info.data.split("\n");

                info.data.forEach(function (line) {
                    if (line.match("^attribute::")) {
                        result.value = line.slice(11);
                    } else if (line.match("^id:n:")) {
                        result.contactId = line.slice(5);
                    } else if (line.match("^kind:n:")) {
                        result.field = kindAttributeMap[parseInt(line.slice(7), 10)];
                    } else if (line.match("^subKind:n:")) {
                        result.type = subKindAttributeMap[parseInt(line.slice(10), 10)];
                    }
                });

                cb(result, "done");
            }
        };

    application.invocation.addEventListener("childCardClosed", callback);
}

function getAccountFilters(options) {
    if (options.includeAccounts) {
        options.includeAccounts = options.includeAccounts.map(function (acct) {
            return acct.id.toString();
        });
    }

    if (options.excludeAccounts) {
        options.excludeAccounts = options.excludeAccounts.map(function (acct) {
            return acct.id.toString();
        });
    }
}

function processJnextSaveData(result, JnextData) {
    var data = JnextData,
        birthdayInfo;

    if (data._success === true) {
        //data.birthday = convertBirthday(data.birthday);
        result.callbackOk(data, false);
    } else {
        result.callbackError(data.code, false);
    }
}

function processJnextRemoveData(result, JnextData) {
    var data = JnextData;

    if (data._success === true) {
        result.callbackOk(data);
    } else {
        result.callbackError(ContactError.UNKNOWN_ERROR, false);
    }
}

function processJnextFindData(eventId, eventHandler, JnextData) {
    console.log("I am in processJnextFindData");
    var data = JnextData,
        i,
        l,
        more = false,
        resultsObject = {},
        birthdayInfo;
/*
    if (data.contacts) {
        for (i = 0, l = data.contacts.length; i < l; i++) {
            data.contacts[i].birthday = convertBirthday(data.contacts[i].birthday);
        }
*/
    if (!data.contacts) {
        data.contacts = []; // if JnextData.contacts return null, return an empty array
    }

    if (data._success === true) {
        eventHandler.error = false;
    }

    //if (eventHandler.multiple) {
        // Concatenate results; do not add the same contacts
        for (i = 0, l = eventHandler.searchResult.length; i < l; i++) {
            resultsObject[eventHandler.searchResult[i].id] = true;
        }

        for (i = 0, l = data.contacts.length; i < l; i++) {
            if (resultsObject[data.contacts[i].id]) {
                // Already existing
            } else {
                eventHandler.searchResult.push(data.contacts[i]);
            }
        }

        // check if more search is required
        //eventHandler.searchFieldIndex++;
        //if (eventHandler.searchFieldIndex < eventHandler.searchFields.length) {
          //  more = true;
        //}
    //} else {
      //  eventHandler.searchResult = data.contacts;
    //}

    //if (more) {
      //  pimContacts.getInstance().invokeJnextSearch(eventId);
    //} else {
        if (eventHandler.error) {
            eventHandler.result.callbackError(data.code, false);
        } else {
            eventHandler.result.callbackOk(eventHandler.searchResult, false);
        }
    //}
}

module.exports = {
    find: function (success, fail, args, env) {
        console.log("I am in contacts index find!");
        var findOptions = {},
            result = new PluginResult(args, env),
            key;

        for (key in args) {
            if (args.hasOwnProperty(key)) {
                findOptions[key] = JSON.parse(decodeURIComponent(args[key]));
            }
        }

        if (!checkPermission(result/*success, findOptions["_eventId"])*/)) {
            return;
        }

        if (!contactUtils.validateFindArguments(findOptions.options)) {
            /*
            _event.trigger(findOptions._eventId, {
                "result": escape(JSON.stringify({
                    "_success": false,
                    "code": ContactError.INVALID_ARGUMENT_ERROR
                }))
            });*/
//            success();
            result.callbackError({
                "result": escape(JSON.stringify({
                    "_success": false,
                    "code": ContactError.INVALID_ARGUMENT_ERROR
                }))
            });
            return;
        }

        getAccountFilters(findOptions.options);
        console.log("I will call pimContacts find!");
        pimContacts.getInstance().find(findOptions, result, processJnextFindData);

        //success();
        result.noResult(true);
    },

    getContact: function (success, fail, args, env) {
        var findOptions = {},
            pluginResult = new PluginResult(args, env),
            results;

        if (!_utils.hasPermission(config, "access_pimdomain_contacts")) {
            result.error("Permission denied");
            return;
        }

        findOptions.contactId = JSON.parse(decodeURIComponent(args.contactId));
        findOptions.contactId = findOptions.contactId.toString();

        results = pimContacts.getInstance().getContact(findOptions);
        if (results._success) {
            if (results.contact && results.contact.id) {
                pluginResult.ok(results.contact, false);
            } else {
                pluginResult.error("Unknown error");
            }
        } else {
            pluginResult.error("Unknown error");
        }
    },

    save: function (success, fail, args, env) {
        var attributes = {},
            result = new PluginResult(args, env),
            key,
            nativeEmails = [];
/*
        for (key in args) {
            if (args.hasOwnProperty(key)) {
                attributes[key] = JSON.parse(decodeURIComponent(args[key]));
            }
        }
*/
        if (!checkPermission(result /* success, attributes["_eventId"])*/)) {
            return;
        }

        attributes = JSON.parse(decodeURIComponent(args[0]));

        if (attributes.emails) {
            attributes.emails.forEach(function (email) {
                if (email.value) {
                    if (email.type) {
                        nativeEmails.push({ "type" : email.type, "value" : email.value });
                    } else {
                        nativeEmails.push({ "type" : "home", "value" : email.value });
                    }
                }
            });
            attributes.emails = nativeEmails;
        }

        attributes["isWork"] = !_utils.isPersonal();

        if (attributes.id !== null) {
            attributes.id = window.parseInt(attributes.id);
        }

        attributes._eventId = result.callbackId;

        pimContacts.getInstance().save(attributes, result, processJnextSaveData);
        //success();
        result.noResult(true);
    },

    remove: function (success, fail, args, env) {
        var result = new PluginResult(args, env),
            attributes = { "contactId" : JSON.parse(decodeURIComponent(args.contactId)),
                           "_eventId" : JSON.parse(decodeURIComponent(args._eventId))};

        if (!checkPermission(result /*success, attributes["_eventId"]*/)) {
            return;
        }

        if (!window.isNaN(attributes.contactId)) {
            pimContacts.getInstance().remove(attributes, result, processJnextRemoveData);
            result.noResult(true);
        } else {
            result.error(ContactError.UNKNOWN_ERROR);
            result.noResult(false);
        }

//        success();
    },

    invokeContactPicker: function (success, fail, args, env) {
        var result = new PluginResult(args, env),
            options = JSON.parse(decodeURIComponent(args["options"])),
            callback = function (args, reason) {
                //_event.trigger("invokeContactPicker.eventId", args, reason);
                result.callbackOk({
                    "type": "doneCancel",
                    "data": args,
                    "reason": reason
                });
            };

        if (!checkPermission(/*success, "invokeContactPicker.invokeEventId"*/ result)) {
            return;
        }

        // Validate options
        if (!options || typeof(options.mode) === "undefined") {
            options = new ContactPickerOptions();
        }

        if (!contactUtils.validateContactsPickerOptions(options)) {
            return;
        }

        // start listening to childCardClosed event from navigator before invoking picker
        onChildCardClosed(callback);
        pimContacts.getInstance().invokePicker(options, result, function (invokeResult) {
            result.callbackOk({
                "type": "invoke",
                "result": invokeResult
            }, invokeResult._success);
        });
        //success();
        result.noResult(true);
    },

    getContactAccounts: function (success, fail, args) {
        var result = {};

        if (!_utils.hasPermission(config, "access_pimdomain_contacts")) {
            fail(ContactError.PERMISSION_DENIED_ERROR, PERMISSION_DENIED_MSG);
            return;
        }
        result = pimContacts.getInstance().getContactAccounts();
        if (result._success) {
            success(result.accounts);
        } else {
            fail(-1, "Failed to get accounts");
        }        
    }
};

///////////////////////////////////////////////////////////////////
// JavaScript wrapper for JNEXT plugin
///////////////////////////////////////////////////////////////////

JNEXT.PimContacts = function ()
{   
    var self = this,
        hasInstance = false;
/*
    self.find = function (cordovaFindOptions, pluginResult, handler) {
        console.log("I am in JNEXT find!");
        //register find eventHandler for when JNEXT onEvent fires
        self.eventHandlers[cordovaFindOptions.callbackId] = {
            "result" : pluginResult,
            "action" : "find",
            //"multiple" : cordovaFindOptions[1].filter ? true : false,
            "fields" : cordovaFindOptions[0],
            //"searchFilter" : cordovaFindOptions[1].filter,
            "searchFields" : cordovaFindOptions[1].filter ? populateSearchFields(cordovaFindOptions[0]) : null,
            "searchFieldIndex" : 0,
            "searchResult" : [],
            "handler" : handler,
            "error" : true
        };

        self.invokeJnextSearch(cordovaFindOptions.callbackId);
        return "";
    };
*/
    self.find = function (findOptions, pluginResult, handler) {
        console.log("I am in find!");
        var jnextArgs = {};
            //findHandler = self.eventHandlers[findOptions.callbackId];

        self.eventHandlers[findOptions.callbackId] = {
            "result" : pluginResult,
            "action" : "find",
            "searchResult" : [],
            "handler" : handler,
            "error" : true
        };

        jnextArgs._eventId = findOptions.callbackId;
        jnextArgs.fields = findOptions.fields;
        jnextArgs.options = findOptions.options;
        jnextArgs.options.filter = [];
/*
        if (findHandler.multiple) {
            jnextArgs.options.filter.push({
                "fieldName" : findHandler.searchFields[findHandler.searchFieldIndex],
                "fieldValue" : findHandler.searchFilter
            });
            //findHandler.searchFieldIndex++;
        }
*/
        console.log("invoke!");
        JNEXT.invoke(self.m_id, "find " + JSON.stringify(jnextArgs));
    }

    self.getContact = function (args) {
        console.log("I am in JNEXT getContact");
        return JSON.parse(JNEXT.invoke(self.m_id, "getContact " + JSON.stringify(args)));
    };

    self.save = function (args, pluginResult, handler) {
        //register save eventHandler for when JNEXT onEvent fires
        self.eventHandlers[args._eventId] = {
            "result" : pluginResult,
            "action" : "save",
            "handler" : handler
        };
        JNEXT.invoke(self.m_id, "save " + JSON.stringify(args));
        return "";
    };

    self.remove = function (args, pluginResult, handler) {
        //register remove eventHandler for when JNEXT onEvent fires
        self.eventHandlers[args._eventId] = {
            "result" : pluginResult,
            "action" : "remove",
            "handler" : handler
        };
        JNEXT.invoke(self.m_id, "remove " + JSON.stringify(args));
        return "";
    };

    self.invokePicker = function (options, pluginResult) {
        self.eventHandlers["invokeContactPicker.invokeEventId"] = {
            "result": pluginResult,
            "action": "invokePicker"
        };
        JNEXT.invoke(self.m_id, "invokePicker " + JSON.stringify(options));
    };

    self.getId = function () {
        return self.m_id;
    };

    self.getContactAccounts = function () {
        var value = JNEXT.invoke(self.m_id, "getContactAccounts");
        return JSON.parse(value);
    };

    self.init = function () {
        if (!JNEXT.require("libpimcontacts")) {
            return false;
        }

        self.m_id = JNEXT.createObject("libpimcontacts.PimContacts");
        
        if (self.m_id === "") {
            return false;
        }

        JNEXT.registerEvents(self);
    };
   
    self.onEvent = function (strData) {
        var arData = strData.split(" "),
            strEventDesc = arData[0],
            eventHandler,
            args = {};
            
        if (strEventDesc === "result") {
            args.result = escape(strData.split(" ").slice(2).join(" "));
            eventHandler = self.eventHandlers[arData[1]];
            //_event.trigger(arData[1], args);
            if (eventHandler.action === "save" || eventHandler.action === "remove") {
                eventHandler.handler(eventHandler.result, JSON.parse(decodeURIComponent(args.result)));
            } else if (eventHandler.action === "find") {
                eventHandler.handler(arData[1], eventHandler, JSON.parse(decodeURIComponent(args.result)));
            } else if (eventHandler.action === "invokePicker") {
                eventHandler.handler(JSON.parse(decodeURIComponent(args.result)));
            }

        }
    };
    
    self.m_id = "";
    self.eventHandlers = {};

    self.getInstance = function () {
        if (!hasInstance) {
            self.init();
            hasInstance = true;
        }
        return self;
    };
};

pimContacts = new JNEXT.PimContacts();
