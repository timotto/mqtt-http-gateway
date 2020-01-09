/**
 * Subscribes to an MQTT topic and calls HTTP URLs on messages.
 */
export interface MqttToHttp {
  _id?: string;
  mqttServerUrl: string;
  mqttServerOptions: any;
  topic: string;
  webhook: string;
}

/**
 * Stored at some URL and sends a message via MQTT
 */
export interface HttpToMqtt {
  mqttServerUrl: string;
  mqttServerOptions: any;
  topic: string;
}

export interface ConfigRepository {
  mqttToHttp(): Promise<MqttToHttp[]>;
  httpToMqt(id: string): Promise<HttpToMqtt>;
}
