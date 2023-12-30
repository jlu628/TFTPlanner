import Champion from "./champion";
import Trait, { Activation, ActivationTier } from "./trait";
import { HashArray, HashMap, Hashable } from "./utils";
import { DataFetcher, TFTData } from "./fetchData";
import version from "./version";

export default class Team {
    private version: string;
    private champions: HashArray<Champion>;
    private emblems: Emblem[];
    private hextechHearts: Trait[];
    private teamSize: number;
    private maxTeamSize: number;
    private traitActivationStatus: HashMap<Trait, ActivationStatus>;

    constructor(version: string, maxTeamSize?: number, data?: TFTData) {
        this.version = version;
        this.champions = new HashArray();
        this.emblems = [];
        this.hextechHearts = [];
        this.teamSize = 0;
        this.maxTeamSize = maxTeamSize || 9;
        this.traitActivationStatus = new HashMap<Trait, ActivationStatus>();

        SpecialRules.initializeTFTData(data);
    }

    public resetChampions(recalculateTraits = true): void {
        this.champions = new HashArray();
        this.teamSize = 0;
        if (recalculateTraits) {
            this.calculateTraitStatus();
        }
    }

    public resetEmblems(recalculateTraits = true): void {
        this.emblems = [];
        if (recalculateTraits) {
            this.calculateTraitStatus();
        }
    }

    public resetHextechHearts(recalculateTraits = true): void {
        this.hextechHearts = new HashArray<Trait>();
        if (recalculateTraits) {
            this.calculateTraitStatus();
        }
    }

    public addEmblem(emblem: Trait) {
        this.emblems.push({trait: emblem, active: true});
    }

    public addHextechHeart(hextechHeart: Trait) {
        this.hextechHearts.push(hextechHeart);
    }

    public addChampion(champion: Champion): {added: boolean, specialRuleApplied: boolean} {
        if (this.champions.hashIncludes(champion) || 
        this.teamSize + champion.unit > this.maxTeamSize || 
        SpecialRules.runAddRules(this, champion)) {
            return {added: false, specialRuleApplied: false};
        }

        this.champions.push(champion);
        this.teamSize += champion.unit;        
        return {added: true, specialRuleApplied: SpecialRules.runChampionRules(this)};
    }

    public removeChampion(champion: Champion): {removed: boolean, specialRuleApplied: boolean} {
        const removed = this.champions.hashRemove(champion);
        if (removed) {
            this.teamSize -= champion.unit;
            return {removed: true, specialRuleApplied: SpecialRules.runChampionRules(this)}
        }
        return {removed: false, specialRuleApplied: false};
    }

    public calculateTraitStatus(): {emblemRuleApplied: boolean, traitRuleApplied: boolean} {
        const emblemRuleApplied = SpecialRules.runEmblemRules(this);

        this.traitActivationStatus = new HashMap();
        for (const champion of this.champions) {
            for (const trait of champion.traits) {
                const activatonStatus = this.traitActivationStatus.getOrDefault(trait, {
                    memberCount: 0,
                    activationTier: null
                });
                activatonStatus.memberCount++;
                if (!this.traitActivationStatus.has(trait)) {
                    this.traitActivationStatus.set(trait, activatonStatus);
                }
            }
        }

        for (const {trait, active} of this.emblems) {
            if (!active) {
                continue;
            }
            const activatonStatus = this.traitActivationStatus.getOrDefault(trait, {
                memberCount: 0,
                activationTier: null
            });
            activatonStatus.memberCount++;
            if (!this.traitActivationStatus.has(trait)) {
                this.traitActivationStatus.set(trait, activatonStatus);
            }
        }

        for (const trait of this.hextechHearts) {
            const activatonStatus = this.traitActivationStatus.getOrDefault(trait, {
                memberCount: 0,
                activationTier: null
            });
            activatonStatus.memberCount++;
            if (!this.traitActivationStatus.has(trait)) {
                this.traitActivationStatus.set(trait, activatonStatus);
            }
        }

        for (const [trait, activationStatus] of this.traitActivationStatus.entries()) {
            const memberCount = activationStatus.memberCount;
            let tier = -1;
            while (tier + 1 < trait.activations.length && memberCount >= trait.activations[tier+1].memberCount) {
                tier++;
            }
            if (tier > -1) {
                activationStatus.activationTier = trait.activations[tier];
            }
        }

        const traitRuleApplied = SpecialRules.runTraitRules(this);

        return {
            emblemRuleApplied: emblemRuleApplied,
            traitRuleApplied: traitRuleApplied
        }
    }

    public setMaxTeamSize(maxTeamSize: number) {
        this.maxTeamSize = maxTeamSize;
    }

    public getChampions(): HashArray<Champion> {
        return this.champions;
    }

    public getTraitActivationStatus(): HashMap<Trait, ActivationStatus> {
        return this.traitActivationStatus;
    }

    public getEmblems(): Emblem[] {
        return this.emblems;
    }

    public getHextechHearts(): Trait[] {
        return this.hextechHearts;
    }

    public getVersion(): string {
        return this.version;
    }

    public getTeamSize(): number {
        return this.teamSize;
    }

    public getMaxTeamSize(): number {
        return this.maxTeamSize;
    }

    public toString(): string {
        let output = `Team size: \t${this.teamSize}\n`;
        output += `Champions: \t${this.champions.map(champion => champion.name).join(", ")}\n`;
        output += `Emblems: \t${this.emblems.map(emblem => emblem.trait.name + emblem.active ? "" : " (inactive)").join(", ")}\n`;
        output += `Hearts: \t${this.hextechHearts.map(champion => champion.name).join(", ")}\n`;
        output += "Activated traits:\n";

        for (const [trait, activationStatus] of this.traitActivationStatus.entries()) {
            if (activationStatus.activationTier) {
                output += `\t${activationStatus.activationTier.memberCount} ${trait.name} (${activationStatus.activationTier.tier})\n`;
            }
        }

        return output;
    }
}

export interface ActivationStatus {
    memberCount: number,
    activationTier: Activation | null
}

export interface Emblem {
    trait: Trait, 
    active: boolean
}

class SpecialRules {
    public static data: TFTData;
    private static ChampionRules: SpecialRule[] = [SpecialRules.AkaliBreakout];
    private static TraitRules: SpecialRule[] = [SpecialRules.NinjaExactMatch];
    private static EmblemRules: SpecialRule[] = [SpecialRules.EmblemRule];
    private static AddRules: SpecialAddRule[] = [SpecialRules.AkaliBreakoutDuplicate];

    public static async initializeTFTData(data?: TFTData) {
        if (data) {
            SpecialRules.data = data;
        } else {
            SpecialRules.data = await (new DataFetcher(version)).getData();
        }
    }

    //#region Run rule wrappers
    public static runChampionRules(team: Team): boolean {
        let ruleApplied = false;
        for (const rule of SpecialRules.ChampionRules) {
            ruleApplied = ruleApplied || rule(team);
        }
        return ruleApplied;
    }

    public static runTraitRules(team: Team): boolean {
        let ruleApplied = false;
        for (const rule of SpecialRules.TraitRules) {
            ruleApplied = ruleApplied || rule(team);
        }
        return ruleApplied;
    }

    public static runEmblemRules(team: Team):boolean {
        let ruleApplied = false;
        for (const rule of SpecialRules.EmblemRules) {
            ruleApplied = ruleApplied || rule(team);
        }
        return ruleApplied;
    }

    public static runAddRules(team: Team, championToAdd: Champion): boolean {
        let ruleApplied = false;
        for (const rule of SpecialRules.AddRules) {
            ruleApplied = ruleApplied || rule(team, championToAdd);
        }
        return ruleApplied;
    }
    //#endregion

    //#region Champion rules
    public static AkaliBreakout(team: Team): boolean {
        const version = team.getVersion();
        if (!["S10"].includes(version)) {
            return false;
        }

        const AkaliKDA = SpecialRules.data.champion.get("Akali K/DA");
        const AkaliTrueDMG = SpecialRules.data.champion.get("Akali True-DMG");
        const KDA = SpecialRules.data.trait.get("K/DA");
        const TrueDMG = SpecialRules.data.trait.get("True Damage");

        const champions = team.getChampions();
        if (!AkaliKDA || !AkaliTrueDMG || !KDA || ! TrueDMG || 
            (!champions.hashIncludes(AkaliKDA) && !champions.hashIncludes(AkaliTrueDMG))) {
            return false;
        }

        let KDACount = 0;
        let TrueDMGCount = 0;
        for (const champion of champions) {
            if (champion.hash() == AkaliKDA.hash() || champion.hash() == AkaliTrueDMG.hash()) {
                continue;
            }
            
            const traits = new HashArray(...champion.traits);
            if (traits.hashIncludes(KDA)) {
                KDACount++;
            }
            if (traits.hashIncludes(TrueDMG)) {
                TrueDMGCount++;
            }
        }

        if (KDACount > TrueDMGCount) {
            return champions.hashReplace(AkaliTrueDMG, AkaliKDA, true);
        }
        if (KDACount < TrueDMGCount) {
            return champions.hashReplace(AkaliKDA, AkaliTrueDMG, true);
        }

        return false;
    }
    //#endregion

    //#region Trait rules
    public static NinjaExactMatch(team: Team): boolean {
        const version = team.getVersion();
        const ninjaName = "Ninja";
        const ninja = SpecialRules.data.trait.get(ninjaName);
        if (!["S1", "S4", "S4.5"].includes(version) || !ninja) {
            return false;
        }

        const traitStatus = team.getTraitActivationStatus();
        const ninjaActivationStatus = traitStatus.get(ninja);
        if (!ninjaActivationStatus) {
            return false;
        }

        let ninjaCount = 0;
        for (const champion of team.getChampions()) {
            for (const trait of champion.traits) {
                if (trait.name == ninjaName) {
                    ninjaCount++;
                    break;
                }
            }
        }
        if (!ninja.activations.map(a => a.memberCount).includes(ninjaCount)) {
            if (ninjaActivationStatus) {
                ninjaActivationStatus.activationTier = null;
            }
            return true;
        }
        return false;
    }
    //#endregion

    //#region Emblem rules
    public static EmblemRule(team: Team): boolean {
        const emblems = team.getEmblems();
        let ruleApplied = false;

        // Try apply each emblem to the viable champion carrying least emblems
        const championTraitWithEmblem: {championTraits: HashArray<Trait>, carriedEmblems: HashArray<Trait>}[] 
        = team.getChampions().map(champion => ({championTraits: new HashArray(...champion.traits), carriedEmblems: new HashArray()}));
        
        for (const emblem of emblems) {
            let traitCanApply = false;
            for (const {championTraits, carriedEmblems} of championTraitWithEmblem) {
                if (carriedEmblems.length >= 3 || championTraits.hashIncludes(emblem.trait) || carriedEmblems.hashIncludes(emblem.trait)) {
                    continue;
                }
                carriedEmblems.push(emblem.trait);
                traitCanApply = true;
                break;
            }
            championTraitWithEmblem.sort((a, b)=> a.carriedEmblems.length - b.carriedEmblems.length);
            if (emblem.active != traitCanApply) {
                ruleApplied = true;
                emblem.active = traitCanApply;
            }
        }
        return ruleApplied;
    }
    //#endregion

    //#region Add rules
    public static AkaliBreakoutDuplicate(team: Team, championsToAdd: Champion): boolean {
        const version = team.getVersion();

        if (version != "S10") {
            return false;
        }

        if (championsToAdd.name == "Akali K/DA" || championsToAdd.name == "Akali True-DMG"){
            for (const champion of team.getChampions()) {
                if (champion.name == "Akali K/DA" || champion.name == "Akali True-DMG") {
                    return true;
                }
            }
        }
        return false;
    }
}

type SpecialRule = (team: Team) => boolean;
type SpecialAddRule = (team: Team, championToAdd: Champion) => boolean;

// const main = async () => {
//     const data = await new DataFetcher("S10").getData();
//     SpecialRules.data = data;

//     const Ahri = data.champion.get("Ahri");
//     const Akali = data.champion.get("Akali True-DMG");
//     const Ekko = data.champion.get("Ekko");
//     const Neeko = data.champion.get("Neeko");
//     const Seraphine = data.champion.get("Seraphine");
//     const KaiSa = data.champion.get("Kai'Sa");
//     const Kennen = data.champion.get("Kennen");
//     const Lillia = data.champion.get("Lillia");
//     const Evelynn = data.champion.get("Evelynn");
     
//     const team = new Team("S10");
//     if (Ahri && Akali && Ekko && Neeko && Seraphine && KaiSa && Kennen && Lillia && Evelynn) {
//         team.addChampion(Ahri);
//         team.addChampion(Akali);
//         team.addChampion(Ekko);
//         team.addChampion(Neeko);
//         team.addChampion(Seraphine);
//         team.addChampion(KaiSa);
//         team.addChampion(Kennen);
//         team.addChampion(Lillia);
//         team.addChampion(Evelynn);
//     }
//     team.calculateTraitStatus();
//     console.log(team.toString());
// }

// main();