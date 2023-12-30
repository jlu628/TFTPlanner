import { electronAPI } from "../server/preload";
import Champion from "../tft/champion";
import { TFTData } from "../tft/fetchData";
import Trait from "../tft/trait";

declare global {
    interface Window {
        ElectronAPI: typeof electronAPI;
    };
    type TFTDataClientType = TFTData;
    type ChampionClientType = Champion;
    type TraitClientType = Trait;
}