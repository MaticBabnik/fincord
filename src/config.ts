import { readFileSync } from "fs";

interface IConfigFile {
    appName: string;
    jellyfin: {
        address: string;
        username: string;
        password: string;
    };
    discord: {
        guildId: string;
        clientId: string;
        token: string;
    }
}


type ShittyTypeDef = { [key: string]: ShittyTypeDef | "string" | "number" | "boolean" | "object" | "array" | "null" | "undefined" };
function shittyValidateObject<OutType>(object: Record<string, any>, typeDef: ShittyTypeDef, path: string = "object"): OutType {
    const keys = Object.keys(typeDef);
    keys.forEach(key => {
        const validatorType = typeof (typeDef[key]);
        if (validatorType === "string") { // validator type is a string which means we just do a type check
            if (typeof (object[key]) !== typeDef[key]) {
                throw new Error(`${path}.${key} is not of type ${typeDef[key]}`);
            }
        } else if (typeof (typeDef[key]) === "object") {
            if (typeof (object[key]) !== "object")
                throw new Error(`${path}.${key} is not of type "object"`);
            shittyValidateObject(object[key], <ShittyTypeDef>typeDef[key], `${path}.${key}`);
        }
    });
    return <OutType><any>object;
}

const configTypeDef: ShittyTypeDef = {
    appName: "string",
    jellyfin: {
        address: "string",
        username: "string",
        password: "string"
    },
    discord: {
        guildId: "string",
        clientId: "string",
        token: "string"
    }
};

export class Config {
    protected static config: IConfigFile;
    
    public static get() {
        if (!this.config) {
            const file = readFileSync("./config.json");
            const cfg = JSON.parse(file.toString());
            this.config = shittyValidateObject(cfg, configTypeDef);
        }
        return this.config;
    }
}