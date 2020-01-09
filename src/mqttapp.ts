import * as requestify from 'requestify';
import {MqttHandler} from './mqtt-handler';
import * as debugModule from 'debug';
import {ConfigRepository, MqttToHttp} from './repository';

const mqttHandler: MqttHandler = new MqttHandler();

const debug = debugModule('mqtt-http-gateway:mqttapp');

const MqttApp = {
  start: async (repo: ConfigRepository) => {

    const mqttToHttps = await repo.mqttToHttp();
    mqttToHttps.forEach(doc => {
      const connection = {serverUrl: doc.mqttServerUrl, options: doc.mqttServerOptions};
      mqttHandler.subscribe(connection, doc.topic).subscribe(
        message => handleMessage(doc, message),
        error => debug(`MQTT error on [${JSON.stringify(doc)}]`, error),
        () => debug(`subscription closed ${JSON.stringify(doc)}`));
    });
  },
};

const handleMessage = (mqttHook: MqttToHttp, message) => requestify.post(mqttHook.webhook, {message: message.message})
  .then(result => debug(`webhook [${mqttHook._id}] executed`, result))
  .catch(error => debug(`failed to call webhook [${mqttHook._id}]`, error));

export default MqttApp;
