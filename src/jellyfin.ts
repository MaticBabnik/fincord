import { Config } from "./config";
import * as JellyfinSdk from "@thornbill/jellyfin-sdk";
//system api
import { getSystemApi } from "@thornbill/jellyfin-sdk/lib/utils/api/system-api"
//search api
import { getSearchApi } from "@thornbill/jellyfin-sdk/lib/utils/api/search-api"
import { SearchApi } from "@thornbill/jellyfin-sdk/lib/generated-client/api/search-api"
//audio api
import { getAudioApi } from "@thornbill/jellyfin-sdk/lib/utils/api/audio-api"
import { AudioApi } from "@thornbill/jellyfin-sdk/lib/generated-client/api/audio-api"
//sessions api
import { getSessionApi } from "@thornbill/jellyfin-sdk/lib/utils/api/session-api"
import { SessionApi } from "@thornbill/jellyfin-sdk/lib/generated-client/api/session-api"
//playstate api
import { getPlaystateApi } from "@thornbill/jellyfin-sdk/lib/utils/api/playstate-api"
import { PlaystateApi, PlaystateApiReportPlaybackProgressRequest, PlaystateApiReportPlaybackStartRequest } from "@thornbill/jellyfin-sdk/lib/generated-client/api/playstate-api"


import { BaseItemKind, GeneralCommandType, PlaybackProgressInfo, PlaybackStartInfo, RepeatMode } from "@thornbill/jellyfin-sdk/lib/generated-client/models";

import { JellySock } from "./jellysock";

interface SearchResult { id: string, title: string };

const cfg = Config.get();
const config = cfg.jellyfin;
const { appName } = cfg;

type IJellyQueue = { Id: string, PlaylistItemId: string }[];

export class Jellyfin {
    //singleton stuff
    private static _instance: Jellyfin;
    public static get() {
        if (!this._instance) {
            this._instance = new Jellyfin();
        }

        return this._instance;
    }

    private static fin: JellyfinSdk.Jellyfin;

    private api: JellyfinSdk.Api;
    private token: string = "";
    private sessionId: string = "";
    private searchApi?: SearchApi;
    private audioApi?: AudioApi;
    private sessionApi?: SessionApi;
    private playstateApi?: PlaystateApi;
    private sock: JellySock;

    public getApi() {
        return this.api;
    }

    public async login() {
        const authResult = await this.api.authenticateUserByName(config.username, config.password);
        this.token = authResult.data.AccessToken!;
        this.sessionId = authResult.data.SessionInfo?.Id!;
        this.api.accessToken = this.token;
        this.sock.updateToken(this.token);

        this.searchApi = getSearchApi(this.api);
        this.audioApi = getAudioApi(this.api);
        this.sessionApi = getSessionApi(this.api);
        this.playstateApi = getPlaystateApi(this.api);

        const systemApi = getSystemApi(this.api);
        const { data } = await systemApi.getPublicSystemInfo()
        console.log(`Logged in to Jellyfin server "${data.ServerName}" running version ${data.Version}`);

        console.log("Connecting to ws");
        this.sock.open();
        this.sock.once('connected', () => {
            this.sessionApi!.postFullCapabilities({
                clientCapabilitiesDto: {
                    SupportsMediaControl: true,
                    SupportedCommands: [
                        GeneralCommandType.Play,
                        GeneralCommandType.PlayState,
                        GeneralCommandType.PlayMediaSource,
                        GeneralCommandType.SetRepeatMode,
                        GeneralCommandType.SetShuffleQueue,
                        GeneralCommandType.DisplayMessage,
                    ],
                    PlayableMediaTypes: ["Audio"]
                }
            }).then(() => { }).catch(err => {
                console.error("Failed to set capabilities");
                console.error(err);
            });
        });
    }

    public async search(query: string): Promise<SearchResult[]> {
        try {
            const { data } = await this.searchApi!.get({
                searchTerm: query,
                includeItemTypes: [BaseItemKind.Audio]
            });
            console.log(data)

            return data.SearchHints
                ?.map(hint => ({ id: hint.Id!, title: hint.Name! })) // remove unused fields
                ?.filter(e => e.id && e.title) // useless sanity check; typescript still doesnt belive me :(
                ?? [];
        } catch {
            return [];
        }

    }

    public getStreamUrl(id: string) {
        return `${this.api.basePath}/Audio/${id}/stream.opus?audioCodec=opus&maxBitrate=96000`;
    }

    public getSocket() {
        return this.sock;
    }

    public reportPlaybackStart(mediaId: string, state?: Partial<PlaybackStartInfo>) {
        this.playstateApi?.reportPlaybackStart({
            playbackStartInfo: {
                ItemId: mediaId,
                MediaSourceId: mediaId,
                SessionId: this.sessionId,
                PlaySessionId: this.sessionId,
                PositionTicks: 0,
                CanSeek: true,
                ...state,
                RepeatMode: RepeatMode.RepeatNone,
                //@ts-ignore
                PlaybackRate: 1,
                //@ts-ignore
                ShuffleMode: "Sorted"
            }
        }).catch(err => {
            console.error("Failed to report playback start");
            console.error(err);
        })
    }

    public reportPlaybackProgress(mediaId: string, paused: boolean, position: number, state?: Partial<PlaybackProgressInfo>) {
        this.playstateApi?.reportPlaybackProgress({
            playbackProgressInfo: {
                ItemId: mediaId,
                MediaSourceId: mediaId,
                SessionId: this.sessionId,
                PlaySessionId: this.sessionId,
                PositionTicks: position * 10000,
                IsPaused: paused,
                CanSeek: true,
                ...state,
                RepeatMode: RepeatMode.RepeatNone,
                //@ts-ignore
                PlaybackRate: 1,
                //@ts-ignore
                ShuffleMode: "Sorted"
            }
        }).catch(err => {
            console.error("Failed to report playback progress");
            console.error(err);
        });
    }

    public reportPlaybackStop() {
        this.playstateApi?.reportPlaybackStopped({
            playbackStopInfo: {
                SessionId: this.sessionId,
            }
        }).catch(err => {
            console.error("Failed to report playback stop");
            console.error(err);
        });;
    }

    private constructor() {
        Jellyfin.fin = new JellyfinSdk.Jellyfin({
            clientInfo: {
                name: appName ?? "Fincord",
                version: "1.0.0",
            },
            deviceInfo: {
                name: "node-js",
                id: "node-js",
            }
        })
        this.api = Jellyfin.fin.createApi(config.address);
        this.sock = new JellySock(config.address, "", 'node-js');
    }
}

