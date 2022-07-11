# Fincord
Jellyfin discord bot aimed at small friend groups

## How to use
- use `/join` for the bot to join your voice channel
- open the Jellyfin UI and connect to the fincord session
- play music from the Jellyfin UI
- use `/leave` to leave the voice channel

## How to run
- install the dependencies with `npm i`
- create `config.json`
```json
{
    "appName": "Fincrod",
    "jellyfin": {
        "address":"https://jellyfin.example.com",
        "username": "musicUser",
        "password": "leaveEmptyIfNotRequired"
    },
    "discord": {
        "guildId": "<for registring guild commands, can be an empty string>",
        "clientId": "<for registring commands, required>",
        "token":"<the bot token>"
    }
}
```
- register the commands with 
```bash
npm run register guild
# --- or ---
npm run register global
```
- run the bot with
```
npm run start
```
## Docker
```bash
# build with
docker build -t fincord .
# run with
docker run -dit \
  --name fincord --restart always \
  --mount type=bind,source="$(pwd)/config.json",target=/app/config.json\
  fincord
```