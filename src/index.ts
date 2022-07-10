
import { Discord } from "./discord";
import { Jellyfin } from "./jellyfin";

const discord = Discord.get();
const jellyfin = Jellyfin.get();

discord.getDiscordClient().once('ready', ({ user }) => {
    console.log(`Logged in as ${user.tag}`);
    user.setPresence({ activities: [{ type: "LISTENING", name: "your bad music" }] });
})

console.log('Starting up...');
discord.login();
jellyfin.login();
