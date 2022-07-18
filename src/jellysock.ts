import WebSocket from "ws";
import { EventEmitter } from "events"

export interface JellyMessage<T> {
    MessageType: string,
    MessageId?: string,
    Data: T
}

export type JellyEmptyMessage = JellyMessage<undefined>;

interface JellySockEvents {
    "connected": (s: JellySock, ws: WebSocket) => any,
    "message": (s: JellySock, msg: JellyMessage<any>) => any,
    "disconnected": () => any
}


export declare interface JellySock {
    on<U extends keyof JellySockEvents>(
        event: U, listener: JellySockEvents[U]
    ): this;

    once<U extends keyof JellySockEvents>(
        event: U, listener: JellySockEvents[U]
    ): this;

    emit<U extends keyof JellySockEvents>(
        event: U, ...args: Parameters<JellySockEvents[U]>
    ): boolean;
}


export class JellySock extends EventEmitter {
    protected socketUrl: string;
    protected socket?: WebSocket;
    protected keepAlive?: NodeJS.Timer;

    protected baseurl: string;
    protected token: string;
    protected device: string;


    static toSocketUrl(base: string, token: string, device: string) {
        let su = new URL(base)
        su.pathname += "/socket";
        su.protocol = su.protocol.replace('http', 'ws');

        su.search = `?api_key=${token}&deviceId=${device}`;

        return su.toString();
    }

    public sendMessage(type: string, data?: any) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            throw new Error("Socket not open");
        }

        const obj: Record<string, any> = { MessageType: type };
        if (data)
            obj.Data = data;

        this.socket.send(JSON.stringify(obj));
    }

    protected openHandler(ws: WebSocket) {
        console.log('[JellySock] open');
        this.emit('connected', this, ws);

        if (!this.keepAlive) {
            this.sendMessage("KeepAlive");
            this.keepAlive = setInterval(() => {
                this.sendMessage("KeepAlive");
            }, 1000 * 30);
        }
    }

    protected messageHandler(data: any) {
        const msg = JSON.parse(data);
        this.emit("message", this, msg);
    }

    protected closeHandler(ws: WebSocket) {
        console.log('[JellySock] close');
        this.emit('disconnected');
        if (this.keepAlive) {
            clearInterval(this.keepAlive);
            this.keepAlive = undefined;
        }

        console.log("[JellySock] Waiting 1 s before reconnecting");
        setTimeout(() => {
            this.open();
        }, 1000);
    }

    public open() {
        console.log(`[JellySock] Connecting to "${this.socketUrl}"`);
        this.socket = new WebSocket(this.socketUrl);

        this.socket.on("open", this.openHandler.bind(this));
        this.socket.on("close", this.closeHandler.bind(this));
        this.socket.on("message", this.messageHandler.bind(this));
    }

    public updateToken(newToken: string) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            throw "Too late";
        } else
            this.token = newToken;
        this.socketUrl = JellySock.toSocketUrl(this.baseurl, this.token, this.device);
    }

    constructor(baseUrl: string, token: string, device: string) {
        super();
        this.baseurl = baseUrl;
        this.token = token;
        this.device = device;
        this.socketUrl = JellySock.toSocketUrl(this.baseurl, this.token, this.device);
    }
}