import {Observable, Subscriber} from "rxjs";
import {IClientOptions, MqttClient, connect} from "mqtt";

export class MqttHandler {

    private mqttClients: Map<MqttServerConnection, MqttClient> = new Map();

    private mqttSubscriptions: Map<MqttServerConnection, Map<string, TopicSubscription>> = new Map();

    private mqttClientPublishUsage: Map<MqttServerConnection, number> = new Map();

    private onConnectedCallMap: Map<MqttClient, Function[]> = new Map();

    constructor(private idleTimeout: number = 60000) {
    }

    subscribe(mqttServerConnection: MqttServerConnection, topic: string): Observable<MqttMessage> {
        return new Observable((subscriber: Subscriber<MqttMessage>) => {
            const mqttClient = this.getClientForConnection(mqttServerConnection);
            const subscription = this.getSubscription(mqttServerConnection, topic);

            if (subscription.isUnused) {
                const subscribeCall = () => mqttClient.subscribe(topic, (error) => {
                    if (error) subscriber.error(error);
                });

                this.onConnectedCall(mqttClient, subscribeCall);
            }

            subscription.subscribe(subscriber);

            return () => {
                subscription.unsubscribe(subscriber);
                if (subscription.isUnused) {
                    mqttClient.unsubscribe(topic);
                    this.cleanup();
                }
            }
        });
    }

    publish(mqttServerConnection: MqttServerConnection, mqttMessage: MqttMessage): Observable<void> {
        return new Observable(subscriber => {
            const mqttClient = this.getClientForConnection(mqttServerConnection);
            const publishCall = () => mqttClient.publish(mqttMessage.topic, mqttMessage.message, (error) => {
                if (error !== undefined) subscriber.error(error);
                subscriber.complete();
                this.cleanup();
            });

            this.use(mqttServerConnection);
            this.onConnectedCall(mqttClient, publishCall);
        });
    }

    private cleanup() {
        let nextCleanupTimeout = undefined;
        this.mqttSubscriptions.forEach((subscriptions, connection) => {
            subscriptions.forEach((subscription, topic) => {
                if (subscription.isUnused) subscriptions.delete(topic);
            });
            if (subscriptions.size === 0) {
                this.mqttClients.get(connection).end();
                this.mqttClients.delete(connection);
                this.mqttSubscriptions.delete(connection);
            }
        });
        this.mqttClients.forEach((mqttClient, connection) => {
            if (!this.mqttSubscriptions.has(connection)) {
                const idleTimeLeft = this.idleTimeout - this.usedBefore(connection);
                if (idleTimeLeft <= 0) {
                    mqttClient.end();
                    this.mqttClients.delete(connection);
                    this.mqttClientPublishUsage.delete(connection);
                } else if (nextCleanupTimeout === undefined || nextCleanupTimeout > idleTimeLeft) {
                    nextCleanupTimeout = idleTimeLeft;
                }
            }
        });
        if (nextCleanupTimeout !== undefined) setTimeout(() => this.cleanup(), nextCleanupTimeout);
    }

    private use(mqttServerConnection: MqttServerConnection) {
        this.mqttClientPublishUsage.set(mqttServerConnection, new Date().getTime());
    }

    private usedBefore(mqttServerConnection: MqttServerConnection): number {
        const now = new Date().getTime();
        // never used for publish -> longest possible time / extremely idle
        if (!this.mqttClientPublishUsage.has(mqttServerConnection)) return now;

        return now - this.mqttClientPublishUsage.get(mqttServerConnection);
    }

    private getSubscription(mqttServerConnection: MqttServerConnection, topic: string): TopicSubscription {
        if (!this.mqttSubscriptions.has(mqttServerConnection)) this.mqttSubscriptions.set(mqttServerConnection, new Map());
        const map = this.mqttSubscriptions.get(mqttServerConnection);

        if (!map.has(topic)) map.set(topic, new TopicSubscription());
        return map.get(topic);
    }

    private getClientForConnection(mqttServerConnection: MqttServerConnection): MqttClient {
        const existingClient = this.mqttClients.get(mqttServerConnection);
        if (existingClient !== undefined) return existingClient;

        const mqttClient = connect(mqttServerConnection.serverUrl, mqttServerConnection.options);
        mqttClient.on('error', error => this.allSubscribers(mqttServerConnection).error(error));
        mqttClient.on('message', (topic: string, payload: Buffer) => this.allSubscribers(mqttServerConnection, topic)
            .next({topic: topic, message: payload.toString()}));
        mqttClient.on('connect', () => {
            if (this.onConnectedCallMap.has(mqttClient)) {
                this.onConnectedCallMap.get(mqttClient).forEach(func => func());
                this.onConnectedCallMap.delete(mqttClient);
            }
        });
        this.mqttClients.set(mqttServerConnection, mqttClient);
        return mqttClient;
    }

    private onConnectedCall(mqttClient: MqttClient, func: Function) {
        if (mqttClient.connected) {
            func();
            return;
        }

        if (!this.onConnectedCallMap.has(mqttClient)) this.onConnectedCallMap.set(mqttClient, []);
        this.onConnectedCallMap.get(mqttClient).push(func);
    }

    private fallbackSubscription = new TopicSubscription();

    private allSubscribers(mqttServerConnection: MqttServerConnection, topic?: string): TopicSubscription {
        const subscribedTopics = this.mqttSubscriptions.get(mqttServerConnection);
        if (subscribedTopics === undefined) return this.fallbackSubscription;

        if (topic === undefined) {
            const allSubscriptions = new TopicSubscription();
            subscribedTopics.forEach((subscription) => allSubscriptions.subscribers.push(...subscription.subscribers));

            return allSubscriptions;
        }

        const subscription = subscribedTopics.get(topic);
        if (subscription === undefined) return this.fallbackSubscription;

        return subscription;
    }

}

export class TopicSubscription {
    subscribers: Subscriber<MqttMessage>[] = [];

    subscribe(subscriber: Subscriber<MqttMessage>) {
        this.subscribers.push(subscriber);
    }

    unsubscribe(subscriber: Subscriber<MqttMessage>) {
        const index = this.subscribers.indexOf(subscriber);
        if (index === -1) return;
        this.subscribers.splice(index, 1);
    }

    next(mqttMessage: MqttMessage) {
        this.subscribers.forEach(subscriber => subscriber.next(mqttMessage));
    }

    error(error: any) {
        this.subscribers.forEach(subscriber => subscriber.error(error));
    }

    get isUnused(): boolean {
        return this.subscribers.length === 0;
    }
}

export class MqttServerConnection {
    serverUrl: string;
    options?: IClientOptions;
}

export class MqttMessage {
    topic: string;
    message: any;
}
