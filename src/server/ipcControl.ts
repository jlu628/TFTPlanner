import { ipcMain, BrowserWindow  } from "electron";
import Champion from "../tft/champion";
import Trait, { Activation, ActivationTier } from "../tft/trait";
import { TFTData } from "../tft/fetchData";
import Team, { ActivationStatus } from "../tft/team";
import version from "../tft/version";
import CompSuggestion from "../tft/compSuggest";

export const IpcCommand = {
    MainCommand: {
        controlWindow: "control-window",
        loadTFTData: "load-tft-data",
        syncTeamToServer: "sync-team-to-server",
        syncEmblemToServer: "set-emblem",
        syncHextechHeartToServer: "set-hextech-heart",
        acceptSuggestedChampion: "accept-suggested-champion",
        setMaxTeamSize: "set-max-team-size",
        toggleCompSuggestion: "toggle-comp-suggestion",
        setCompSuggestionTierLimits: "set-comp-suggestion-tier-limits",
        recalculateCompSuggestion: "recalculate-comp-suggestion"
    },
    RendererCommand: {
        TFTDataLoaded: "tft-data-loaded",
        syncTeamToClient: "sync-team-to-client",
        syncTraitStatusToClient: "sync-trait-status-to-client",
        syncEmblemStatusToClient: "sync-emblem-status-to-client",
        syncHextechHeartsToClient: "sync-hextech-hearts-to-client",
        syncCompSuggestionToClient: "sync-comp-suggestion-to-client"
    }
}

export default class IpcController {
    private window: BrowserWindow;
    private data: TFTData;
    private team: Team;
    private compSuggest: CompSuggestion;
    private clientCompSuggestion: boolean;

    constructor(window: BrowserWindow, data: TFTData) {
        this.window = window;
        this.data = data;
        this.team = new Team(version, 9, this.data);
        this.compSuggest = new CompSuggestion(data);

        this.clientCompSuggestion = true;
    }

    public attachHandlers(): void {
        this.loadTFTDataHandler();
        this.controlWindowHandler();
        this.syncTeamToServerHandler();
        this.syncEmblemToServerHandler();
        this.syncHextechHeartToServerHanlder();
        this.acceptSuggestedChampionHandler();
        this.recalculateCompSuggestionHandler();

        this.setMaxTeamSizeHandler();
        this.toggleCompSuggestionHandler();
        this.setCompSuggestionTierLimitsHandler();
    }

    public loadTFTDataHandler(): void {
        ipcMain.on(IpcCommand.MainCommand.loadTFTData, (event) => {
            this.window.webContents.send(IpcCommand.RendererCommand.TFTDataLoaded, this.data)
        });
    }

    public controlWindowHandler(): void {
        ipcMain.on(IpcCommand.MainCommand.controlWindow, (event, controlType: string) => {
            switch (controlType) {
                case 'close':
                    this.window.close();
                    break;
                case 'minimize':
                    this.window.minimize();
                    break;
                case 'maximize':
                    if (this.window.isMaximized()) {
                        this.window.restore();
                    } else {
                        this.window.maximize();
                    }
                break;
            }
        });
    }

    public syncCompSuggestionToClient(): void {
        // Set up a new team
        this.compSuggest.setTeam(this.team, true);
        
        const suggestedChampions = this.compSuggest.getCompSuggestion();

        this.window.webContents.send(IpcCommand.RendererCommand.syncCompSuggestionToClient, suggestedChampions.map(c => c.name));
        this.syncTraitStatusToClient(true, this.compSuggest.getSuggestedTeam(suggestedChampions))
    }

    public acceptSuggestedChampionHandler(): void {
        ipcMain.on(IpcCommand.MainCommand.acceptSuggestedChampion, (event, championName: string) => {
            const champion = this.data.champion.get(championName);
            if (!champion) {
                return;
            }
            this.team.addChampion(champion);
        })
    }

    public recalculateCompSuggestionHandler(): void {
        ipcMain.on(IpcCommand.MainCommand.recalculateCompSuggestion, (event, championName: string) => {
            if (this.isSyncCompRequirementMet()) {
                this.syncCompSuggestionToClient();
            }
        });
    }

    public syncTeamToServerHandler(): void {
        ipcMain.on(IpcCommand.MainCommand.syncTeamToServer, (event, champions: string[]) => {
            // Server side validation, check if team exceeds max size
            let teamSize = 0;
            const maxTeamSize = this.team.getMaxTeamSize();
            for (const championName of champions) {
                const champion = this.data.champion.get(championName);
                if (champion) {
                    teamSize += champion.unit;
                }
            }
            if (teamSize > maxTeamSize) {
                return;
            }

            // Build team
            this.team.resetChampions(false);
            const synchedTeam: string[] = [];

            let specialRuleCheck = false;
            teamSize = 0;
            for (const championName of champions) {
                const champion = this.data.champion.get(championName);
                if (champion) {
                    const {added, specialRuleApplied} = this.team.addChampion(champion);
                    specialRuleCheck = specialRuleCheck || specialRuleApplied;
                    if (added) {
                        synchedTeam.push(champion.name);
                        teamSize += champion.unit;
                        continue;
                    }
                }
                synchedTeam.push("");
                teamSize++;
            }

            // Apply changes made by special rules
            if (specialRuleCheck) {
                let teamChampionIdx = 0;
                const champions = this.team.getChampions();
                for (let i = 0; i < synchedTeam.length; i++) {
                    if (synchedTeam[i] == "") {
                        continue;
                    }
                    if (teamChampionIdx >= champions.length) {
                        break;
                    }
                    synchedTeam[i] = champions[teamChampionIdx].name;
                    teamChampionIdx++;
                }
            }

            // Add or remove empty slot if team contains champion with unit > 1
            if (teamSize > maxTeamSize) {
                let count = 0;
                for (let idx = synchedTeam.length - 1; idx >= 0; idx--) {
                    if (synchedTeam[idx] === "") {
                        synchedTeam.splice(idx, 1);
                        count++;
                        if (count >= teamSize - maxTeamSize) {
                            break;
                        }
                    }
                }
            }
            
            if (teamSize < maxTeamSize) {
                for (let count = 0; count < maxTeamSize - teamSize; count++) {
                    synchedTeam.push("");
                }
            }

            this.window.webContents.send(IpcCommand.RendererCommand.syncTeamToClient, synchedTeam);

            if (this.clientCompSuggestion && this.isSyncCompRequirementMet()) {
                return this.syncCompSuggestionToClient();
            } else {
                this.syncTraitStatusToClient();
            }
        });
    }

    public syncEmblemToServerHandler(): void {
        ipcMain.on(IpcCommand.MainCommand.syncEmblemToServer, (event, traits: string[]) => {
            this.team.resetEmblems(false);
            for (const traitName of traits) {
                const trait = this.data.trait.get(traitName);
                if (!trait) {
                    continue;
                }
                this.team.addEmblem(trait);
            }

            if (this.clientCompSuggestion && this.isSyncCompRequirementMet()) {
                return this.syncCompSuggestionToClient();
            } else {
                this.syncTraitStatusToClient();
            }
        });
    }

    public syncHextechHeartToServerHanlder(): void {
        ipcMain.on(IpcCommand.MainCommand.syncHextechHeartToServer, (event, traits: string[]) => {
            this.team.resetHextechHearts(false);
            for (const traitName of traits) {
                const trait = this.data.trait.get(traitName);
                if (!trait) {
                    continue;
                }
                this.team.addHextechHeart(trait);
            }
            this.window.webContents.send(IpcCommand.RendererCommand.syncHextechHeartsToClient, this.team.getHextechHearts().map(h => h.name));
            
            if (this.clientCompSuggestion && this.isSyncCompRequirementMet()) {
                return this.syncCompSuggestionToClient();
            } else {
                this.syncTraitStatusToClient();
            }
        });
    }

    private syncTraitStatusToClient(forceSyncEmblems=false, compSuggestionTeam: Team | null = null) {
        let teamToSync: Team;
        if (compSuggestionTeam) {
            teamToSync = compSuggestionTeam;
        } else {
            teamToSync = this.team;
        }

        const { emblemRuleApplied } = teamToSync.calculateTraitStatus();
        if (emblemRuleApplied || forceSyncEmblems) {
            const clientEmblem: [string, boolean][] = teamToSync.getEmblems().map(emblem => [emblem.trait.name, emblem.active]);
            this.window.webContents.send(IpcCommand.RendererCommand.syncEmblemStatusToClient, clientEmblem);
        }

        const clientTraitStatus : [string, ActivationStatus][] = [];
        for (const [trait, activationStatus] of teamToSync.getTraitActivationStatus().entries()) {
            clientTraitStatus.push([trait.name, activationStatus]);
        }

        const tiers = {
            [ActivationTier.Bronze]: 0, 
            [ActivationTier.Silver]: 1,
            [ActivationTier.Gold]: 2,
            [ActivationTier.Prismatic]: 3
        };
        clientTraitStatus.sort((a, b) => {
            const activationTierA = a[1].activationTier;
            const activationTierB = b[1].activationTier;
            if (activationTierA == null && activationTierB != null) {
                return 1;
            }
            if (activationTierA != null && activationTierB == null) {
                return -1;
            }

            if (activationTierA != null && activationTierB != null &&
                activationTierA.tier != activationTierB.tier) {
                return tiers[activationTierB.tier] - tiers[activationTierA.tier];
            }
            return b[1].memberCount - a[1].memberCount;
        })

        this.window.webContents.send(IpcCommand.RendererCommand.syncTraitStatusToClient, clientTraitStatus);
    }

    public setMaxTeamSizeHandler(): void {
        ipcMain.on(IpcCommand.MainCommand.setMaxTeamSize, (_event, maxTeamSize: number) => {
            this.team.setMaxTeamSize(maxTeamSize);

            if (this.clientCompSuggestion && this.isSyncCompRequirementMet()) {
                this.syncCompSuggestionToClient();
            }
        })
    }

    public toggleCompSuggestionHandler(): void {
        ipcMain.on(IpcCommand.MainCommand.toggleCompSuggestion, (event, compSuggestionOn: boolean) => {
            this.clientCompSuggestion = compSuggestionOn;
            if (!this.clientCompSuggestion) {
                // Reset client display by force recalculate trait status with cached team
                this.syncTraitStatusToClient(true, null);
            } else if (this.isSyncCompRequirementMet()) {
                this.syncCompSuggestionToClient();
            }
        });
    }

    public setCompSuggestionTierLimitsHandler(): void {
        ipcMain.on(IpcCommand.MainCommand.setCompSuggestionTierLimits, (event, lowerTier: number, upperTier: number) => {
            if (lowerTier < 1 || upperTier > 5 || lowerTier > upperTier) {
                return;
            }

            this.compSuggest.setLowerTier(lowerTier);
            this.compSuggest.setUpperTier(upperTier);

            if (this.clientCompSuggestion && this.isSyncCompRequirementMet()) {
                this.syncCompSuggestionToClient();
            }
        });
    }

    private isSyncCompRequirementMet(): boolean {
        return  this.team.getChampions().length >= 4 || (this.team.getMaxTeamSize() - this.team.getTeamSize() <= 4);
    }
}