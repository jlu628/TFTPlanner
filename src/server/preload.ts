import { contextBridge, ipcRenderer, IpcRendererEvent} from 'electron';
import Champion from '../tft/champion';
import { IpcCommand } from './ipcControl';
import { TFTData } from '../tft/fetchData';
import { ActivationStatus, Emblem } from '../tft/team';

const { MainCommand, RendererCommand } = IpcCommand;
export const electronAPI = {
    controlWindow: (controlType: string) => {ipcRenderer.send(MainCommand.controlWindow, controlType)},
    loadTFTData: () => (ipcRenderer.send(MainCommand.loadTFTData)),
    syncTeamToServer: (champions: string[]) => (ipcRenderer.send(MainCommand.syncTeamToServer, champions)),
    setMaxTeamSize: (maxTeamSize: number) => (ipcRenderer.send(MainCommand.setMaxTeamSize, maxTeamSize)),
    toggleCompSuggestion: (compSuggestionOn: boolean) => (ipcRenderer.send(MainCommand.toggleCompSuggestion, compSuggestionOn)),
    setCompSuggestionTierLimits: (lowerTier: number, upperTier: number) => (ipcRenderer.send(MainCommand.setCompSuggestionTierLimits, lowerTier, upperTier)),
    syncEmblemToServer: (traits: string[]) => (ipcRenderer.send(MainCommand.syncEmblemToServer, traits)),
    syncHextechHeartToServer: (traits: string[]) => (ipcRenderer.send(MainCommand.syncHextechHeartToServer, traits)),
    acceptSuggestedChampion: (champion: string) => (ipcRenderer.send(MainCommand.acceptSuggestedChampion, champion)),
    recalculateCompSuggestion: () => (ipcRenderer.send(MainCommand.recalculateCompSuggestion)),

    TFTDataLoaded: (callback: (event:IpcRendererEvent, data: TFTData) => void) => {ipcRenderer.on(RendererCommand.TFTDataLoaded, callback)},
    syncTeamToClient: (callback: (event: IpcRendererEvent, champions: string[])=> void) => {ipcRenderer.on(RendererCommand.syncTeamToClient, callback)},
    syncTraitStatusToClient: (callback: (event: IpcRendererEvent, traits: [string, ActivationStatus][]) => void) => {ipcRenderer.on(RendererCommand.syncTraitStatusToClient, callback)},
    syncEmblemStatusToClient: (callback: (event: IpcRendererEvent, emblems: [string, boolean][]) => void) => {ipcRenderer.on(RendererCommand.syncEmblemStatusToClient, callback)},
    syncHextechHeartsToClient: (callback: (event: IpcRendererEvent, hextechHearts: string[]) => void) => {ipcRenderer.on(RendererCommand.syncHextechHeartsToClient, callback)},
    syncCompSuggestionToClient: (callback: (event: IpcRendererEvent, champions: string[]) => void) => {ipcRenderer.on(RendererCommand.syncCompSuggestionToClient, callback)}
}

contextBridge.exposeInMainWorld("ElectronAPI", electronAPI);