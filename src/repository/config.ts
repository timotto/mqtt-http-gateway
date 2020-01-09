import {ConfigRepository, HttpToMqtt, MqttToHttp} from './index';

export class EnvConfig implements ConfigRepository {
  private readonly data: EnvValue;
  constructor(envValue: string) {
    this.data = JSON.parse(envValue);
    if (this.data.mqttToHttp === undefined) {
      this.data.mqttToHttp = [];
    }
    if (this.data.httpToMqtt === undefined) {
      this.data.httpToMqtt = {};
    }
  }

  async httpToMqt(id: string): Promise<HttpToMqtt> {
    return this.data.httpToMqtt[id];
  }

  async mqttToHttp(): Promise<MqttToHttp[]> {
    return this.data.mqttToHttp;
  }
}

interface EnvValue {
  httpToMqtt: {[id: string]: HttpToMqtt};
  mqttToHttp: MqttToHttp[];
}
