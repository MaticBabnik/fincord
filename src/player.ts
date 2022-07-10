import { Jellyfin } from "./jellyfin";
import { JellyEmptyMessage, JellyMessage, JellySock } from "./jellysock";
import { joinVoiceChannel, getVoiceConnection, createAudioPlayer, AudioPlayer, NoSubscriberBehavior, AudioResource, createAudioResource, } from "@discordjs/voice"

import { FFmpeg } from "prism-media"

interface JPlay {
    PlayCommand: "PlayNow",
    ItemIds: string[];
    StartIndex?: number;
    ControllingUserId: string;
}
interface JPlayState {
    SeekPositionTicks: number;
    Command: "Seek" | "PlayPause" | "Stop" | "NextTrack" | "PreviousTrack";
    ControllingUserId: string;
}

interface JGeneralCommand {
    Name: "DisplayMessage";
    Arguments: Object
    ControllingUserId: string;
}

interface JellySockEventHandler {
    "jellyfinPlay": (js: JellySock, msg: JellyMessage<JPlay>) => any,
    "jellyfinPlaystate": (js: JellySock, msg: JellyMessage<JPlayState>) => any,
    "jellyfinKeepAlive": (js: JellySock, msg: JellyMessage<any>) => any,
    "jellyfinGeneralCommand": (js: JellySock, msg: JellyMessage<JGeneralCommand>) => any,
}

const eventToHandlerMap: { [index: string]: keyof JellySockEventHandler } = {
    "Play": "jellyfinPlay",
    "Playstate": "jellyfinPlaystate",
    "KeepAlive": "jellyfinKeepAlive",
    "GeneralCommand": "jellyfinGeneralCommand",
}


export class JellyfinPlayer implements JellySockEventHandler {
    protected socket: JellySock;
    protected queue: string[] = [];
    protected playingIndex: number = 0;

    protected currentState: "playing" | "paused" | "stopped" = "stopped";
    protected lastTime: number = 0;
    protected lastTimestamp: number = 0;

    public get state() {
        return {
            NowPlayingQueue: this.queue.map(
                (id, i) => ({ Id: id, PlaylistItemId: `playlistItem${i}` })
            ),
            PlayListItemId: `playlistItem${this.playingIndex}`,
        };
    }

    public playId(id: string, time: number = 0) {
        console.log(time);
        if (time === 0) {
            this.player.play(createAudioResource(this.fin.getStreamUrl(id)));
        } else {
            const a = new FFmpeg({
                args: [
                    '-i', this.fin.getStreamUrl(id), '-ss', (time).toFixed(3),
                    '-analyzeduration', '0', '-loglevel', '0', '-f', 'opus', '-ar', '48000', '-ac', '2'
                ]
            })
            this.player.play(createAudioResource(a));
        }
        this.currentState = "playing";
        this.lastTime = time * 1000;
        this.lastTimestamp = Date.now();
    }

    public handleJellyfin(js: JellySock, msg: JellyMessage<any>) {
        const event = msg.MessageType;
        const handler = eventToHandlerMap[event];
        if (handler) {
            this[handler](js, msg);
        } else {
            console.log(`No handler for ${event}`); 1
        }
    }

    public jellyfinPlay(js: JellySock, msg: JellyMessage<JPlay>) {
        this.queue = msg.Data.ItemIds;
        this.playingIndex = msg.Data.StartIndex || 0;

        this.playId(msg.Data.ItemIds[this.playingIndex])

        this.fin.reportPlaybackStart(this.queue[this.playingIndex], this.state);
    }

    public jellyfinPlaystate(js: JellySock, msg: JellyMessage<JPlayState>) {
        let pstatus = this.player.state.status;

        switch (msg.Data.Command) {
            case "Seek":
                this.playId(this.queue[this.playingIndex], msg.Data.SeekPositionTicks / 10_000_000);
                break;
            case "PlayPause":
                if (pstatus === "playing") {
                    this.player.pause();
                }
                else {
                    this.player.unpause();
                    console.log(`Playing from ${this.lastTime}`);
                    this.fin.reportPlaybackProgress(this.queue[this.playingIndex], false, this.lastTime, this.state);
                }
                break;
            case "Stop":
                this.player.stop();
                this.fin.reportPlaybackStop();
                break;
            case "NextTrack":
                if (this.playingIndex > this.queue.length - 1) {
                    this.fin.reportPlaybackStop();
                    this.queue = [];
                    this.playingIndex = -1;
                    break;
                }
                this.playingIndex++;
                this.playId(this.queue[this.playingIndex]);

                this.fin.reportPlaybackStart(this.queue[this.playingIndex], this.state);
                break;
            case "PreviousTrack":
                if (this.playingIndex < 1) {
                    this.fin.reportPlaybackStop();
                    this.queue = [];
                    this.playingIndex = -1;
                    break;
                }
                this.playingIndex--;
                this.playId(this.queue[this.playingIndex]);

                this.fin.reportPlaybackStart(this.queue[this.playingIndex], this.state);
                break;
            default:
                console.error(`Unknown playstate command ${msg.Data.Command}`);
        }
    }

    public jellyfinGeneralCommand(js: JellySock, msg: JellyMessage<JGeneralCommand>) {
        const command = msg.Data;
        switch (command.Name) {
            case "DisplayMessage":
                console.log(command.Arguments);
                break;
            default:
                console.error(`Unknown generalcommand ${command.Name}`);
        }
    }

    public jellyfinKeepAlive(js: JellySock, msg: JellyMessage<any>) {
        // literally nothing
    }

    constructor(protected fin: Jellyfin, protected player: AudioPlayer) {
        this.socket = fin.getSocket();
        this.socket.on('message', this.handleJellyfin.bind(this));
        //@ts-ignore
        this.player.on('stateChange', (olds, news) => {
            console.log(`Player state ${olds.status}=>${news.status}`);
            switch (news.status) {
                case "playing":
                    this.currentState = "playing";
                    this.fin.reportPlaybackProgress(this.queue[this.playingIndex], false, this.lastTime, this.state);
                    break;
                case "paused":
                    this.currentState = "paused";
                    this.lastTime = + Date.now() - this.lastTimestamp;
                    this.lastTimestamp = Date.now();

                    this.fin.reportPlaybackProgress(this.queue[this.playingIndex], true, this.lastTime, this.state);
                    break;
                case "idle":
                    //song has ended?
                    this.currentState = "stopped";
                    this.lastTime = 0;
                    this.lastTimestamp = Date.now();

                    if (this.playingIndex + 1 >= this.queue.length) {
                        this.fin.reportPlaybackStop();
                        this.queue = [];
                        this.playingIndex = -1;
                    } else {
                        this.playingIndex++;
                        this.playId(this.queue[this.playingIndex]);

                        this.fin.reportPlaybackStart(this.queue[this.playingIndex], this.state);
                    }

                    break;
            }
        })
    }
}