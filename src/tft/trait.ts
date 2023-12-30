import { Hashable } from "./utils";

export default class Trait implements Hashable {
    public name:string;
    public description: string;
    public img: string;
    public activations: Activation[];

    constructor(name: string, description: string, img:string, memberCounts: number[], tiers: ActivationTier[], effects: string[]) {
        this.name = name;
        this.description = description;
        this.img = img;
        if (tiers.length == memberCounts.length && tiers.length == effects.length) {
            this.activations = [];
            for (let i = 0; i < tiers.length; i++) {
                this.activations.push({
                    memberCount: memberCounts[i],
                    tier: tiers[i],
                    effect: effects[i]
                });
            }
        } else {
            throw new EvalError("Unable to parse data: Trait tiers not same length of trait activation levels");
        }
    }

    public hash():string {
        return this.name + this.description;
    }

    public getNextActivationTier(currentActivation: Activation): Activation | null {
        let idx = 0;
        while (idx < this.activations.length ) {
            const activation = this.activations[idx];
            idx++;
            if (activation.effect == currentActivation.effect && activation.memberCount == currentActivation.memberCount && activation.tier == currentActivation.tier) {
                break;
            }
        }
        if (idx >= this.activations.length) {
            return null;
        }
        return this.activations[idx];
    }
}

export interface Activation {
    memberCount: number;
    tier: ActivationTier;
    effect: string;
}

export enum ActivationTier {
    Bronze = "Bronze",
    Silver = "Silver",
    Gold = "Gold",
    Prismatic = "Prismatic"
}