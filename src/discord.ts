import { Client, CommandInteraction, Intents, Interaction, MessageEmbed } from "discord.js"
import { joinVoiceChannel, getVoiceConnection, createAudioPlayer, AudioPlayer, NoSubscriberBehavior, AudioResource, createAudioResource, } from "@discordjs/voice"
import { Config } from "./config"
import { Jellyfin } from "./jellyfin";
import { JellyfinPlayer } from "./player";
import { JellyEmptyMessage, JellyMessage, JellySock } from "./jellysock";

const config = Config.get().discord;

type DiscordCommandName = "play" | "leave" | "join";
type DiscordCommandHandler = (interaction: CommandInteraction) => any;
export type DiscordCommandManager = {
    [key in `command_${DiscordCommandName}`]: DiscordCommandHandler;
}



export class Discord implements DiscordCommandManager {
    //singleton stuff
    private static _instance: Discord;
    public static get() {
        if (!this._instance) {
            this._instance = new Discord();
        }

        return this._instance;
    }

    private client: Client;
    private audioplayer: AudioPlayer;
    private fin: Jellyfin;

    private queue: string[] = [];
    private cIndex: number = 0;
    private player: JellyfinPlayer;
    public getDiscordClient() {
        return this.client;
    }

    //#region Discord handlers
    private respondAndDelete(interaction: CommandInteraction, message: string) {
        try {
            interaction.reply(message);
            setTimeout(() => interaction.deleteReply(), 1000);
        } catch { }
    }

    public handleDiscordCommand(interaction: CommandInteraction) {
        const commandName = <DiscordCommandName>interaction.commandName

        try {
            this[`command_${commandName}`](interaction);
        } catch (e) {
            console.error(e);
        }

    }

    public async command_join(interaction: CommandInteraction) {
        const { user, guild } = interaction;
        const member = guild!.members.cache.get(user.id);

        const voiceChannel = member!.voice.channel!;
        const conn = joinVoiceChannel({ guildId: guild!.id, channelId: voiceChannel.id, adapterCreator: guild!.voiceAdapterCreator });
        conn.subscribe(this.audioplayer);

        this.respondAndDelete(interaction, "Joined voice channel");
    };

    public async command_leave(interaction: CommandInteraction) {
        const { id } = interaction.guild!;
        const conn = getVoiceConnection(id);
        if (conn) {
            try {
                await conn.destroy();
                this.respondAndDelete(interaction, "Left voice channel");
            } catch {
                console.error("Failed to disconnect");
                interaction.reply({ ephemeral: true, content: "Something went wrong..." });
            }
        } else {
            interaction.reply({ ephemeral: true, content: "Not in a voice channel" });
        }
    }

    public async command_play(interaction: CommandInteraction) {
        interaction.reply("deprecated command 😭");
    }
    //#endregion

    private constructor() {
        this.client = new Client({
            intents: [
                Intents.FLAGS.GUILDS,
                Intents.FLAGS.GUILD_MEMBERS,
                Intents.FLAGS.GUILD_MESSAGES,
                Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
                Intents.FLAGS.DIRECT_MESSAGES,
                Intents.FLAGS.DIRECT_MESSAGE_REACTIONS,
                Intents.FLAGS.DIRECT_MESSAGE_TYPING,
                Intents.FLAGS.GUILD_VOICE_STATES
            ]
        });

        this.client.on('interactionCreate', (interaction) => {
            if (interaction.isCommand()) {
                this.handleDiscordCommand(interaction)
            }
        });

        this.audioplayer = createAudioPlayer({
            behaviors: {
                noSubscriber: NoSubscriberBehavior.Play
            }
        });

        this.fin = Jellyfin.get();
        this.player = new JellyfinPlayer(this.fin, this.audioplayer);
    }

    public async login() {
        await this.client.login(config.token)
    }

}