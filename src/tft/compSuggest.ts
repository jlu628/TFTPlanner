import Champion from "./champion";
import Trait, { ActivationTier } from "./trait";
import Team from "./team";
import version from "./version";
import { TFTData } from "./fetchData";

export default class CompSuggestion {
    private team: Team;
    private data: TFTData;
    private lowerTier: number;
    private upperTier: number;
    private intialChampionList: Champion[] = [];

    constructor(data: TFTData, team?: Team) {
        this.team = team || new Team(version);
        this.data = data;
        this.lowerTier = 1;
        this.upperTier = 5;
    }

    public setTeam(team: Team, copy: boolean) {
        if (!copy) {
            this.team = team;
        } else {
            this.team = new Team(version, team.getMaxTeamSize(), this.data)
            for (const {trait} of team.getEmblems()) {
                this.team.addEmblem(trait);
            }
            for (const trait of team.getHextechHearts()) {
                this.team.addHextechHeart(trait);
            }
            this.intialChampionList = [];
            for (const champion of team.getChampions()) {
                this.intialChampionList.push(champion);
                this.team.addChampion(champion);
            }
        }
    }

    public getSuggestedTeam(suggestedChampions: Champion[]): Team {
        for (const champion of suggestedChampions) {
            this.team.addChampion(champion);
        }
        return this.team;
    }

    public getCompSuggestion(): Champion[] {
        const iter = 50;
        const results: CompSuggestionResult[] = [];
        for (let i = 0; i < iter; i++) {
            results.push(this.suggestComp());
        }

        results.sort((a,b) => (b.score - a.score));
        return results[0].suggestedChampions;
    }

    private suggestComp(): CompSuggestionResult {
        const suggestedChampions: Champion[] = [];
        const possibleChampions = [...this.data.champion.values()].filter(champion => (champion.tier >= this.lowerTier && champion.tier <= this.upperTier));

        while (this.team.getTeamSize() < this.team.getMaxTeamSize()) {
            const championChoiceMap: {champion: Champion, weightRange: [number, number]}[] = [];
            let totalWeight = 0;
            for (const champion of possibleChampions) {
                if (this.team.getChampions().hashIncludes(champion) || champion.unit + this.team.getTeamSize() > this.team.getMaxTeamSize()) {
                    continue;
                }

                let weight = this.computeChampionWeight(champion);
                if (weight > 0) {
                    // Prefer higher cost over lower cost
                    championChoiceMap.push({champion: champion, weightRange: [totalWeight, totalWeight + weight]});
                    totalWeight += weight;
                }
            }
            
            if (totalWeight == 0) {
                break;
            }

            // Randomly pick a champion by weight to add to suggested comp
            const randSelect = Math.random() * totalWeight;
            for (const {champion, weightRange} of championChoiceMap) {
                const [lowerWeight, upperWeight] = weightRange;
                if (randSelect >= lowerWeight && randSelect < upperWeight) {
                    const {added} = this.team.addChampion(champion);
                    if (added) {
                        suggestedChampions.push(champion);
                    }
                    break;
                }
            }
        }

        const score = this.evaluateComp();

        // Reset champions for next loop
        this.resetComp();

        return {suggestedChampions: suggestedChampions, score: score};
    }

    /**
     * Calculate weight rule:
      - Base weight: 1
      - For each trait the champion have:
          - If trait is unique (only 1 champion, 1 tier), weight + 50
          - If adding the trait would cause it to be newly activated, weight += 100
          - If trait is not activated and adding would not cause it to be newly activated, let n = # till activation after adding this one, weight += 75 - 5* n
          - If trait is already activated, let n = # till next tier after adding this one, weight += 80 - 15 * n
          - If trait is already activated at highest tier, weight -= 1 (do not encourage picking it)
     */
    private computeChampionWeight(champion: Champion): number {
        this.team.calculateTraitStatus();
        const traitStatus = this.team.getTraitActivationStatus();

        let weight = 1;
        for (const trait of champion.traits) {
            const activationStatus = traitStatus.get(trait);
            if (!activationStatus) {
                // Case trait is unique
                if (trait.activations.length == 1 && trait.activations[0].memberCount == 1) {
                    weight += 50;
                }
                continue;
            }

            const {memberCount, activationTier} = activationStatus;
            // Case trait not yet activated
            if (activationTier == null) {
                const initialActivation = trait.activations[0];
                // Case adding trait would newly activate it
                if (initialActivation.memberCount == memberCount + 1) {
                    weight += 100;
                } else {
                    // Case adding trait would not activate it
                    weight += 75 - 5 * (initialActivation.memberCount - memberCount - 1);
                }
                continue;
            }

            // Case trait already activated
            const nextActivationTier = trait.getNextActivationTier(activationTier);
            // Case activation at highest tier
            if (nextActivationTier == null) {
                weight -= 1;
                continue;
            }

            // Case activation not at highest tier
            weight += 80 - 15 * (nextActivationTier.memberCount - memberCount - 1);
        }
        return weight * (1 + champion.tier / 10);
    }


    private evaluateComp(): number {
        this.team.calculateTraitStatus();
        const traitStatus = this.team.getTraitActivationStatus();

        const powerupFactors = {
            [ActivationTier.Bronze]: 1, 
            [ActivationTier.Silver]: 1.25,
            [ActivationTier.Gold]: 1.5,
            [ActivationTier.Prismatic]: 2
        };

        let score = 0;
        for (const {activationTier, memberCount} of traitStatus.values()) {
            if (!activationTier) {
                continue;
            }
            score += memberCount * powerupFactors[activationTier.tier];
        }
        return score;
    }

    private resetComp() {
        this.team.resetChampions(false);
        for (const champion of this.intialChampionList) {
            this.team.addChampion(champion);
        }
    }

    public setLowerTier(tier: number) {
        this.lowerTier = tier;
    }

    public setUpperTier(tier: number) {
        this.upperTier = tier;
    }
}

interface CompSuggestionResult {
    suggestedChampions: Champion[],
    score: number
}