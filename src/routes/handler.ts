import {Router} from 'express';
import {MqttHandler} from '../mqtt-handler';
import {EnvConfig} from '../repository/config';
import {HttpToMqtt} from '../repository';

const httpHandler = (config: EnvConfig, mqttHandler: MqttHandler): Router =>{
    const handler: Router = Router();
    handler.post('/:id', (req, res) =>
      config.httpToMqt(req.params['id'])
        .then(result => executeWebhook(req, res, result))
        .catch(error => reportError(res, error)));

    const executeWebhook = (req, res, webhook: HttpToMqtt) => mqttHandler.publish(
      {serverUrl: webhook.mqttServerUrl, options: webhook.mqttServerOptions},
      {topic: webhook.topic, message: extractMessage(req)})
      .subscribe(
        result => res.json({status: result}),
        error => reportError(res, error),
        () => res.json({status: 'ok'}));

    return handler;
};

const extractMessage = (req) => {
    if (!req.body) return undefined;
    if (req.body['message']) return req.body['message'];
    return req.body;
};

const reportError = (res, error) => {
    console.error(error);
    res.status(500).json({error: error});
};

export default httpHandler;
