import Trait from "./trait";
import { Hashable } from "./utils";

export default class Champion implements Hashable{
    public name: string;
    public tier: number;
    public img: string;
    public unit: number;
    public traits: Trait[];

    constructor(name: string, tier: number, unit: number, img: string, traits: Trait[]) {
        this.name = name;
        this.tier = tier;
        this.unit = unit;
        this.img = img;
        this.traits = traits;
    }

    public hash(): string {
        return this.name + this.tier;
    }
}