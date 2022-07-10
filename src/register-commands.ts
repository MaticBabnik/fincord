import { SlashCommandBuilder } from "@discordjs/builders";
import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v10";

import {Config} from "./config";
const {discord} = Config.get();

const commands = [
    new SlashCommandBuilder().setName("join").setDescription("Join the voice channel of the user").setDMPermission(false),
    new SlashCommandBuilder().setName("leave").setDescription("Leave the voice channel").setDMPermission(false),
].map(command => command.toJSON());

const r = new REST({ version: "10" }).setToken(discord.token);

const args = process.argv.slice(2);

if (args[0] === 'guild') {
    console.log(`Registering commands for guild ${discord.guildId}`);
    r.put(Routes.applicationGuildCommands(discord.clientId, discord.guildId), { body: commands })
        .then(() => console.log("Commands registered"))
        .catch(console.error);
} else if (args[0] === 'global') {
    console.log(`Registering global commands`);
    r.put(Routes.applicationCommands(discord.clientId), { body: commands })
        .then(() => console.log("Commands registered"))
        .catch(console.error);
} else {
    console.log("Specify either 'guild' or 'global' as the first argument");
}