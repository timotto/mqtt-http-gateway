import * as PouchDB from 'pouchdb';
import * as requestify from 'requestify';
import {MqttHandler} from "./mqtt-handler";

const mqttHandler: MqttHandler = new MqttHandler();
const mqtthookConfigurationDb = new PouchDB(`${process.env.DBURL}/mhg-mqtthooks`);

import * as debugModule from 'debug';

const debug = debugModule('mqtt-http-gateway:mqtthandler');

const MqttApp = {
    start: () => {
        mqtthookConfigurationDb.changes({since: 'now', live: true, include_docs: true})
            .on('change', handleDocument)
            .on('error', error => console.error('db sync error', error));

        mqtthookConfigurationDb.allDocs({include_docs: true})
            .then(allDocs => allDocs.rows.forEach(handleDocument))
    },
    connections: {}
};

const handleMessage = (mqttHook, message) => requestify.post(mqttHook.webhook, {message: message.message})
    .then(result => debug(`webhook [${mqttHook._id}] executed`, result))
    .catch(error => debug(`failed to call webhook [${mqttHook._id}]`, error));

const handleDocument = (doc) => {
    if (MqttApp.connections[doc._id] !== undefined) {
        MqttApp.connections[doc._id].unsubscribe();
    }

    if (doc.deleted) {
        return;
    }

    const connection = {serverUrl: doc.doc.mqttServerUrl, options: doc.doc.mqttServerOptions};
    const subscription = mqttHandler.subscribe(connection, doc.doc.topic).subscribe(
        message => handleMessage(doc.doc, message),
        error => debug(`MQTT error on [${JSON.stringify(doc.doc)}]`, error),
        () => {
            if (MqttApp.connections[doc._id] === subscription) {
                delete MqttApp.connections[doc._id];
            }
        });

    MqttApp.connections[doc._id] = subscription;
};

export default MqttApp;
