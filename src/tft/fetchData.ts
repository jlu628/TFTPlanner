
import axios from 'axios';
import cheerio from 'cheerio';
import Champion from './champion';
import Trait, { ActivationTier, Activation } from './trait';
import path from 'path';
import fs from 'fs';
import version from './version';

export class DataFetcher {
    private __version: string;

    private __championUrls = ["https://mobalytics.gg/tft/champions"];
    private __traitUrls = ["https://mobalytics.gg/tft/synergies/origins", "https://mobalytics.gg/tft/synergies/classes"];
    private __dbRootDir: string;
    private __imgDir: string;

    private __parser: cheerio.Root | null = null;
    private __traits: Map<string, Trait> = new Map();
    private __champions: Map<string, Champion> = new Map;

    constructor(version: string) {
        this.__version = version;
        this.__dbRootDir = path.join(__dirname, `../database/${version}/`)
        this.__imgDir = path.join(this.__dbRootDir, "img");

        if (!fs.existsSync(this.__dbRootDir)) {
            fs.mkdirSync(this.__dbRootDir);
        }
        if (!fs.existsSync(this.__imgDir)) {
            fs.mkdirSync(this.__imgDir);
        }
        if (!fs.existsSync(path.join(this.__imgDir, "champion"))) {
            fs.mkdirSync(path.join(this.__imgDir, "champion"));
        }
        if (!fs.existsSync(path.join(this.__imgDir, "trait"))) {
            fs.mkdirSync(path.join(this.__imgDir, "trait"));
        }
    }

    //#region API for fetch data
    public async getData(): Promise<TFTData> {
        const dbPath = path.join(this.__dbRootDir, "data.json");
        if (fs.existsSync(dbPath) && fs.statSync(dbPath).isFile()) {
            return this.fetchDataFromLocal();
        }
        return this.fetchDataFromServer();
    }

    public async fetchDataFromServer(): Promise<TFTData> {
        await this.fetchTrait();
        await this.fetchChampion();

        const traits: any = {};
        const champions: any = {};

        for (const [name, trait] of this.__traits.entries()) {
            traits[name] = trait;
        }
        for (const [name, champion] of this.__champions.entries()) {
            champions[name] = champion;
        }

        const timestamp = new Date().getTime();
        fs.writeFileSync(path.join(this.__dbRootDir, "data.json"), JSON.stringify({
            version: this.__version,
            timestamp: timestamp,
            champion: Array.from(this.__champions.values()),
            trait: Array.from(this.__traits.values())
        }))

        const result: TFTData = {
            version: this.__version,
            timestamp: timestamp,
            champion: this.__champions,
            trait: this.__traits
        }

        return result;
    }

    public fetchDataFromLocal(): TFTData {
        const data = JSON.parse(fs.readFileSync(path.join(this.__dbRootDir, "data.json"), 'utf-8')) as TFTRawData;
        const result: TFTData = {
            version: data.version,
            timestamp: data.timestamp,
            champion: new Map<string, Champion>(),
            trait: new Map<String, Trait>()
        }
    
        for (const trait of data.trait) {
            const name = trait.name;
            const description = trait.description;
            const img = trait.img;
            const memberCounts = trait.activations.map(a => a.memberCount);
            const tiers = trait.activations.map(a => a.tier);
            const effects = trait.activations.map(a => a.effect);
            result.trait.set(name, new Trait(name, description, img, memberCounts, tiers, effects));
        }
    
        for (const champion of data.champion) {
            const name = champion.name;
            const tier = champion.tier;
            const unit = champion.unit;
            const img = champion.img;
            const traits: Trait[] = [];
            for (const traitRaw of champion.traits) {
                const trait = result.trait.get(traitRaw.name);
                if (trait) {
                    traits.push(trait);
                } else {
                    throw new Error(`Data corrupted: ${champion}`);
                }
            }
            result.champion.set(name, new Champion(name, tier, unit, img, traits));
        }
        return result;
    }
    //#endregion
    
    //#region Fetch traits data
    public async fetchTrait() {
        for (const url of this.__traitUrls) {
            await this.switchParser(url);
            if (this.__parser == null) {
                console.log(`Unable to retrieve data from ${url}`);
                return;
            }

            const traitParser = this.__parser('main > div:last-child > div > div:first-child');
            for (const traitHtml of traitParser) {
                const trait = this.parseTrait(this.__parser(traitHtml));
                if (trait != null) {
                    this.__traits.set(trait.name, trait);
                }
            }
        }
    }

    private parseTrait(traitParser: cheerio.Cheerio): Trait | null {
        if (!this.__parser) {
            return null;
        }

        // Parse basic infos
        const basicInfoParser = this.__parser(traitParser.children().eq(0));
        const traitData = this.getInnerText(basicInfoParser);

        if (traitData.length < 2) {
            console.log(`Unable to parse:\n ${traitParser.html()}\n\nTrait data corrupted: ${traitData.length}\n${traitData}.`)
            return null;
        }
        const name = traitData[0];
        const description = traitData.slice(1, traitData.length).join("\n");

        // Parse activation info
        const activationParser = this.__parser(traitParser.children().eq(1));
        const memberCounts: number[] = [];
        const effects: string[] = [];
        const activationData = this.getInnerText(activationParser);

        if (activationData.length % 2 != 0) {
            console.log(`Unable to parse:\n ${traitParser.html()}\n\nTrait data corrupted: ${traitData.length}\n${traitData}.`)
            return null;
        }
        for (let i = 0; i < activationData.length; i += 2) {
            memberCounts.push(parseInt(activationData[i]));
            effects.push(activationData[i + 1]);
        }

        // Parse trait tiers
        const tiers: ActivationTier[] = [];
        const tiersData = traitParser.find('p[style*="border"]');
        for (const tierData of tiersData) {
            const tierParser = this.__parser(tierData);
            const tier = tierParser.attr("style")?.match(/var\(--placement-['"]?(.*?)['"]?-100\)/);
            if (!tier) {
                tiers.push(ActivationTier.Prismatic);
            } else {
                switch (tier[1]) {
                    case "first":
                        tiers.push(ActivationTier.Gold);
                        break;
                    case "second":
                        tiers.push(ActivationTier.Silver);
                        break;
                    case "third":
                        tiers.push(ActivationTier.Bronze);
                        break;
                }
            }
        }

        // Get the image of the trait
        const traitImg = traitParser.find('img');
        const imgLink = this.__parser(traitImg).attr('src');
        const imgFileName = `${name.replace(/[<>:"\/\\|?*]/g, "")}.svg`;
        const imgPath = path.join(this.__imgDir, "trait", imgFileName);
        if (!imgLink) {
            console.log(`Unable to fetch image for ${name}`)
        } else {
            this.downloadImg(imgLink, imgPath);
        }

        return new Trait(name, description, imgFileName, memberCounts, tiers, effects);
    }
    //#endregion

    //#region Fetch champions data
    public async fetchChampion() {
        for (const url of this.__championUrls) {
            await this.switchParser(url);
            if (this.__parser == null) {
                console.log(`Unable to retrieve data from ${url}`);
                return;
            }

            const championsParser = this.__parser('a[href^="/tft/champions/"] > div');
            for (const championHtml of championsParser) {
                const champion = this.parseChampionInfo(this.__parser(championHtml));
                if (champion != null) {
                    this.__champions.set(champion.name, champion);
                }
            }
        }
    }

    private parseChampionInfo(championParser: cheerio.Cheerio): Champion | null {
        // Get name, tier and traits
        const championData = this.getInnerText(championParser);
        if (championData.length <= 2) {
            console.log(`Unable to parse:\n ${championParser.html()}\n\nChampion data corrupted: ${championData}.`)
            return null;
        }
        const tier = parseFloat(championData[championData.length - 1]);
        const name = championData[championData.length - 2];
        const traitsStr = championData.slice(0, championData.length - 2);
        const traits: Trait[] = [];
        for (const traitStr of traitsStr) {
            const trait = this.__traits.get(traitStr);
            if (!trait) {
                console.log(`Unable to get trait ${traitStr}`)
            } else {
                traits.push(trait);
            }
        }

        // Download thumbnail image for the champion
        const imgLink = championParser.attr('style')?.match(/background-image:\s*url\(['"]?(.*?)['"]?\)/);
        const imgFileName = `${name.replace(/[<>:"\/\\|?*]/g, "")}.png`;
        const imgPath = path.join(this.__imgDir, "champion", imgFileName);
        if (!imgLink) {
            console.log(`Unable to fetch image for ${name}`);
        } else {
            this.downloadImg(imgLink[1], imgPath);
        }

        return new Champion(name, tier, 1, imgFileName, traits);
    }
    //#endregion

    //#region helper functions
    private async downloadImg(url: string, dst: string) {
        if (fs.existsSync(dst) && fs.statSync(dst).isFile()) {
            return;
        }

        const response = await axios.get(url, { responseType: 'arraybuffer' })
        fs.writeFileSync(dst, Buffer.from(response.data));
    }

    private getInnerText = (parser: cheerio.Cheerio): string[] => {
        let texts: string[] = [];

        parser.contents().each((_index, child) => {
            if (child.type === 'text') {
                if (child.data) {
                    texts.push(child.data);
                }
            } else if (child.type === 'tag') {
                const childTexts = this.getInnerText(cheerio(child));
                texts.push(...childTexts);
            }
        });

        return texts;
    }

    private async switchParser(url: string) {
        try {
            const response = await axios.get(url);
            this.__parser = cheerio.load(response.data);
        } catch (error) {
            this.__parser = null;
        }
    }
    //#endregion
}

export interface TFTData {
    version: string,
    timestamp: number,
    champion: Map<String, Champion>,
    trait: Map<String, Trait>
}

interface TFTRawData {
    version: string,
    timestamp: number,
    champion: TFTDataRawChampion[],
    trait: TFTDataRawTrait[]
}

interface TFTDataRawChampion {
    name: string,
    tier: number,
    unit: number,
    img: string,
    traits: TFTDataRawTrait[]
}

interface TFTDataRawTrait {
    name: string,
    description: string,
    img: string,
    activations: Activation[]
}

async function main(){
    const fetcher = new DataFetcher(version);
    const data = await fetcher.getData();
}
