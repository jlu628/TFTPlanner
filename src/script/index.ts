const noChampionImg = "./assets/no_champion.png";

let tftData: TFTDataClientType;
let maxTeamSize = 9;
let imgDbPath: string;

window.ElectronAPI.loadTFTData();

//#region General screen controls
const minimizeButton = document.getElementById("minimize-btn") as HTMLDivElement;
const maximizeButton = document.getElementById("maximize-btn") as HTMLDivElement;
const closeButton = document.getElementById("close-btn") as HTMLDivElement;

minimizeButton.onclick = function() {
    window.ElectronAPI.controlWindow("minimize");
}

maximizeButton.onclick = function() {
    window.ElectronAPI.controlWindow("maximize");
}

closeButton.onclick = function() {
    window.ElectronAPI.controlWindow("close");
}

const championSelectorContainer = document.getElementById("champion-list-container") as HTMLDivElement;
championSelectorContainer.addEventListener('wheel', event => {
    event.preventDefault();
    championSelectorContainer.scrollLeft += event.deltaY;
});
//#endregion

//#region Champion selection section behaviors
function selectTier(tier: number) {
    // Update selection list
    const championListContainer = document.getElementById("champion-list-container") as HTMLDivElement;
    championListContainer.innerHTML = "";
    for (const champion of tftData.champion.values()) {
        if (champion.tier == tier) {
            const img = document.createElement('img');
            img.src = `${imgDbPath}/champion/${champion.img}`;
            img.title = `${champion.name} (${champion.traits.map(trait => trait.name).join(", ")})`;
            img.id = buildChampionInSelectListId(champion.name);
            img.onclick = addChampionToBoard;
            championListContainer.appendChild(img);
        }
    }

    // Remove currently selection
    const currentSelectedTier = document.querySelector(".selected-tier") as HTMLDivElement;
    currentSelectedTier.classList.remove("selected-tier");

    // Update selection
    const newSelectedTier = document.getElementById(getTierSelectId(tier)) as HTMLDivElement;
    newSelectedTier.classList.add("selected-tier")

    // Reset scroll
    championSelectorContainer.scrollLeft = 0;
}

function addChampionToBoard(event: MouseEvent) {
    if (event.target == null) {
        return;
    }
    const championId = (event.target as HTMLImageElement).id;
    const championName = getChampionNameFromSelectListId(championId);

    const championToAdd = tftData.champion.get(championName);
    if (championToAdd == null) {
        return;
    }

    const board = document.querySelectorAll<HTMLImageElement>(".board-slot > img");
    const champions: string[] = [];
    let added = false;
    // Build the team
    for (const slot of board) {
        if (slot.id == buildBoardedId(championName)) {
            return;
        }
        if (slotIsEmpty(slot)) {
            if (!added) {
                champions.push(championToAdd.name);
                added = true;
            } else {
                champions.push("");
            }
        } else {
            champions.push(getChampionNameFromBoardId(slot.id));
        }
    }

    if (added) {
        window.ElectronAPI.syncTeamToServer(champions);
    }
}

function removeChampionFromBoard(event: MouseEvent) {
    if (event.target == null || event.button != 2) {
        return;
    }
    const removedSlot = event.target as HTMLImageElement;
    
    const champions:string[] = [];
    const board = document.querySelectorAll<HTMLImageElement>(".board-slot > img");
    for (const slot of board) {
        if (slot == removedSlot || slotIsEmpty(slot)) {
            champions.push("");
        } else {
            champions.push(getChampionNameFromBoardId(slot.id));
        }
    }
    window.ElectronAPI.syncTeamToServer(champions);
}


function addChampionDisplay(slot: HTMLImageElement, champion: ChampionClientType) {
    slot.src = `${imgDbPath}/champion/${champion.img}`;
    slot.id = buildBoardedId(champion.name);
    slot.oncontextmenu = removeChampionFromBoard;
    slot.title = `${champion.name} (${champion.traits.map(trait => trait.name).join(", ")})`
}

function noChampionDisplay(slot: HTMLImageElement) {
    slot.id = "";
    slot.src = noChampionImg;
    slot.oncontextmenu = null;
    slot.title = "";
}
//#endregion

//#region Other settings panel controls: max team size, comp suggestion on/off and suggestion tier limits 
// Team size settings
const teamSizeInput = document.getElementById("max-team-size-input") as HTMLInputElement;
teamSizeInput.onchange = (_event) => onMaxTeamSizeChange(teamSizeInput.value);

const decrementTeamSizeBtn = document.getElementById("team-size-decrement") as HTMLDivElement;
const incrementTeamSizeBtn = document.getElementById("team-size-increment") as HTMLDivElement;
decrementTeamSizeBtn.onclick = (_event) => onMaxTeamSizeChange("" + (maxTeamSize - 1));
incrementTeamSizeBtn.onclick = (_event) => onMaxTeamSizeChange("" + (maxTeamSize + 1));

function onMaxTeamSizeChange(maxTeamSizeValueStr: string) {
    // Validate new max team size value is numeric and in range of 6 ~ 15
    if (!/^[0-9]+$/.test(maxTeamSizeValueStr)) {
        teamSizeInput.value = "" + maxTeamSize;
        return;
    }
    const maxTeamSizeValue = parseInt(maxTeamSizeValueStr);
    if (maxTeamSizeValue < 6) {
        teamSizeInput.value = "6";
    } else if (maxTeamSizeValue > 15) {
        teamSizeInput.value = "15";
    } else {
        teamSizeInput.value = maxTeamSizeValueStr;
    }

    // If after validation max team size does not change, no need to sync with server
    if (teamSizeInput.value == "" + maxTeamSize) {
        return;
    }

    maxTeamSize = parseInt(teamSizeInput.value);
    window.ElectronAPI.setMaxTeamSize(maxTeamSize);

    // Update boarded team
    const board = document.querySelectorAll<HTMLImageElement>(".board-slot > img");
    let teamSize = 0;
    let champions = [];
    for (const slot of board) {
        const championName = getChampionNameFromBoardId(slot.id);
        const champion = tftData.champion.get(championName);
        if (champion) {
            if (teamSize + champion.unit > maxTeamSize) {
                break;
            }
            champions.push(championName);
            teamSize += champion.unit;
        } else {
            champions.push("");
        }
    }
    window.ElectronAPI.syncTeamToServer(champions);
}

// Comp suggestion toggle button
const compSuggestionToggle = document.getElementById("comp-suggestion-toggle") as HTMLInputElement;
compSuggestionToggle.onchange = function(_event) {
    window.ElectronAPI.toggleCompSuggestion(compSuggestionToggle.checked);
    if (!compSuggestionToggle.checked) {
        clearBoard();
    }
}

function clearBoard() {
    const board = document.querySelectorAll<HTMLImageElement>(".board-slot > img");
    for (const slot of board) {
        if (slotIsEmpty(slot)) {
            noChampionDisplay(slot);
        }
    }
}

let rotated = 0;
const recalculateCompSuggestion = document.getElementById("recalculate-comp-suggestion") as HTMLImageElement;
recalculateCompSuggestion.onclick = () => {
    window.ElectronAPI.recalculateCompSuggestion();

    rotated = rotated + 360;
    recalculateCompSuggestion.style.transform = `rotate(${rotated}deg)`;
}

// Lower and upper tier limit of comp suggestion
let lowerTier = "1";
let upperTier = "5";

const lowerTierInput = document.getElementById("comp-suggestion-lower-tier") as HTMLInputElement;
const upperTierInput = document.getElementById("comp-suggestion-upper-tier") as HTMLInputElement;

lowerTierInput.onchange = setCompSuggestionTiers;
upperTierInput.onchange = setCompSuggestionTiers;
function setCompSuggestionTiers(_event: Event) {
    const lowerTierValue = lowerTierInput.value;
    const upperTierValue = upperTierInput.value;

    const allowedTierValues = ["1","2","3","4","5"];
    if (!allowedTierValues.includes(lowerTierValue) || !allowedTierValues.includes(upperTierValue) ||
    parseInt(lowerTierValue) > parseInt(upperTierValue)) {
        lowerTierInput.value = lowerTier;
        upperTierInput.value = upperTier;
        return;
    } else {
        lowerTier = lowerTierInput.value;
        upperTier = upperTierInput.value;
    }
    window.ElectronAPI.setCompSuggestionTierLimits(parseInt(lowerTier), parseInt(upperTier));
}
//#endregion

//#region Emblems and hex heart selections
const addEmblem = document.getElementById("add-emblem") as HTMLImageElement;
const addHextechHeart = document.getElementById("add-hextech-heart") as HTMLImageElement;
const popupOverlay = document.getElementById("popup-overlay") as HTMLDivElement;
const popupSelection = document.getElementById("popup-selection") as HTMLDivElement;
let traitSelectionType: "emblem" | "hextech heart" | "" = "";

addEmblem.onclick = (_event) => openPopupSelection("emblem");
addHextechHeart.onclick = (_event) => openPopupSelection("hextech heart");

function openPopupSelection(selectionType: typeof traitSelectionType) {
    traitSelectionType = selectionType;
    popupOverlay.style.display = "flex";
}

popupOverlay.onclick = function(event) {
    if (event.target == popupSelection) {
        return;
    }
    traitSelectionType = "";
    popupOverlay.style.display = "none";
}

// Populate trait selections initially
function populatePopupTraitSelection() {
    for (const [traitName, trait] of tftData.trait.entries()) {
        const traitImg = document.createElement('img');
        traitImg.classList.add("trait-selection-img");
        traitImg.src = `${imgDbPath}/trait/${trait.img}`;
        traitImg.onclick = () => onPopupTraitSelected(traitName.valueOf());
        traitImg.title = `${traitName}\n${trait.description}\n\nActivation bonuses:\n${trait.activations.map(a => a.memberCount + ": " + a.effect).join("\n")}`
        popupSelection.appendChild(traitImg);
    }
}

// Trait selected handler
function onPopupTraitSelected(traitName: string) {
    if (traitSelectionType == "emblem") {
        const emblems = document.querySelectorAll<HTMLImageElement>("#emblems-container > img");
        const traits: string[] = [];
        for (const emblem of emblems) {
            traits.push(getTraitNameFromEmblemId(emblem.id));
        }
        traits.push(traitName);
        window.ElectronAPI.syncEmblemToServer(traits);
    } else if (traitSelectionType == "hextech heart") {
        const hearts = document.querySelectorAll<HTMLImageElement>("#hextech-hearts-container > img");
        const traits: string[] = [];
        for (const heart of hearts) {
            traits.push(getTraitNameFromHextechHeartId(heart.id));
        }
        traits.push(traitName);
        window.ElectronAPI.syncHextechHeartToServer(traits);
    }
}

function removeEmblem(event: Event) {
    const emblems = document.querySelectorAll<HTMLImageElement>("#emblems-container > img");
    const traits: string[] = [];
    for (const emblem of emblems) {
        if (emblem == event.target){
            continue;
        }
        traits.push(getTraitNameFromEmblemId(emblem.id));
    }
    window.ElectronAPI.syncEmblemToServer(traits);
}

function removeHextechHeart(event: Event) {
    const hearts = document.querySelectorAll<HTMLImageElement>("#hextech-hearts-container > img");
    const traits: string[] = [];
    for (const heart of hearts) {
        if (heart == event.target) {
            continue;
        }
        traits.push(getTraitNameFromHextechHeartId(heart.id));
    }
    window.ElectronAPI.syncHextechHeartToServer(traits);
}
//#endregion

//#region Ipc Controls
window.ElectronAPI.TFTDataLoaded((_event, data) => {
    tftData = data;
    imgDbPath = `./database/${data.version}/img`;

    // Initial set ups
    selectTier(1);
    populatePopupTraitSelection();
});

window.ElectronAPI.syncTeamToClient((_event, champions) => {
    // Add or remove slot
    const boardContainer = document.getElementById("board-container") as HTMLDivElement;
    boardContainer.innerHTML = "";

    for (const championName of champions) {
        const slotContainer = document.createElement("div");
        slotContainer.classList.add("board-slot", "flexRow", "flexCenter", "alignCenter");
        const slot = document.createElement("img");
        slotContainer.appendChild(slot);
        boardContainer.appendChild(slotContainer);

        const champion = tftData.champion.get(championName);
        if (champion) {
            addChampionDisplay(slot, champion);
        } else {
            noChampionDisplay(slot);
        }
    }
});

window.ElectronAPI.syncTraitStatusToClient((_event, traitStatus) => {
    const traitsContainer = document.getElementById("traits-container") as HTMLDivElement;
    traitsContainer.innerHTML = "";

    for (const [traitName, activationStatus] of traitStatus) {
        const trait = tftData.trait.get(traitName);
        if (!trait) {
            continue;
        }

        const traitStatusContainer = document.createElement("div");
        traitStatusContainer.classList.add("flexCol");
        traitStatusContainer.title = `${traitName}\n${trait.description}${activationStatus.activationTier == null? "" : "\n\nActivation bonus: " + activationStatus.activationTier.effect}`;
        traitsContainer.appendChild(traitStatusContainer);

        const traitActivationInfoContainer = document.createElement("div");
        traitActivationInfoContainer.classList.add("flexRow");
        traitStatusContainer.appendChild(traitActivationInfoContainer);

        const traitImg = document.createElement("img");
        traitImg.classList.add("trait-img");
        if (activationStatus.activationTier == null) {
            traitImg.classList.add("inactivate-trait-img");
        }
        traitImg.src = `${imgDbPath}/trait/${trait.img}`;
        traitActivationInfoContainer.appendChild(traitImg);

        const traitMemberCountContainer = document.createElement("div");
        traitMemberCountContainer.classList.add("flexRow", "flexCenter", "alignCenter", "trait-status-member-count");
        if (activationStatus.activationTier == null) {
            traitMemberCountContainer.classList.add("inactivate-tier");
        } else {
            traitMemberCountContainer.classList.add(`${activationStatus.activationTier.tier.toLowerCase()}-tier`);
        }
        traitMemberCountContainer.innerHTML = "" + activationStatus.memberCount;
        traitActivationInfoContainer.appendChild(traitMemberCountContainer);

        const traitTierListContainer = document.createElement("div");
        traitTierListContainer.classList.add("flexRow", "flexCenter", "alignCenter");
        const activatedMemberCount = (activationStatus.activationTier == null) ? -1 : activationStatus.activationTier.memberCount;
        const tierList:string[] = [];
        for (const {memberCount} of trait.activations) {
            tierList.push(memberCount == activatedMemberCount ? 
                `<span style="color: white;">${memberCount}</span>` : `${memberCount}`);
        }
        traitTierListContainer.innerHTML = tierList.join("&nbsp;&gt;&nbsp;")
        traitStatusContainer.appendChild(traitTierListContainer);
    }
});

window.ElectronAPI.syncEmblemStatusToClient((_event, emblems) => {
    const emblemContainer = document.getElementById("emblems-container") as HTMLDivElement;
    emblemContainer.innerHTML = "";

    const idTable = new Map<string, number>();
    let emblemCount = 0;

    for (const [traitName, isActive] of emblems) {
        const emblem = tftData.trait.get(traitName);
        if (!emblem) {
            continue;
        }

        const img = document.createElement('img');
        img.classList.add("trait-img", isActive ? "selected-trait-img" : "inactivate-selected-trait-img");

        const id = idTable.get(traitName) || 1;
        img.id = buildEmblemId(traitName, id);
        idTable.set(traitName, id+1);

        img.src = `${imgDbPath}/trait/${emblem.img}`;
        img.oncontextmenu = removeEmblem;
        img.title = `${traitName} emblem${isActive ? "" : " (not applied)"}`
        emblemContainer.appendChild(img);

        emblemCount++;
    }

    if (emblemCount < 8) {
        const addBtn = document.createElement('div');
        addBtn.id = "add-emblem";
        addBtn.onclick = (_event) => openPopupSelection("emblem");

        emblemContainer.appendChild(addBtn);
    }
})

window.ElectronAPI.syncHextechHeartsToClient((_event, hextechHearts) => {
    const hextechHeartContainer = document.getElementById("hextech-hearts-container") as HTMLDivElement;
    hextechHeartContainer.innerHTML = "";

    const idTable = new Map<string, number>();
    let hextechHeartCount = 0
    for (const traitName of hextechHearts) {
        const hextechHeart = tftData.trait.get(traitName);
        if (!hextechHeart) {
            continue;
        }

        const img = document.createElement('img');
        img.classList.add("trait-img", "selected-trait-img");
        
        const id = idTable.get(traitName) || 1;
        img.id = buildHextechHeartId(traitName, id);
        idTable.set(traitName, id+1);

        img.src = `${imgDbPath}/trait/${hextechHeart.img}`;
        img.oncontextmenu = removeHextechHeart;
        img.title = `${traitName} hextech heart`;
        hextechHeartContainer.appendChild(img);

        hextechHeartCount++;
    }

    if (hextechHeartCount < 8) {
        const addBtn = document.createElement('div');
        addBtn.id = "add-hextech-heart";
        addBtn.onclick = (_event) => openPopupSelection("hextech heart");

        hextechHeartContainer.appendChild(addBtn);
    }
})

window.ElectronAPI.syncCompSuggestionToClient((event, champions) => {
    const slots = document.querySelectorAll<HTMLImageElement>(".board-slot > img");
    let idx = 0;
    for (const slot of slots) {
        if (slotIsEmpty(slot)) {
            if (idx >= champions.length) {
                return;
            }
            const champion = tftData.champion.get(champions[idx]);
            if (!champion) {
                continue;
            }
            slot.classList.add("suggested-champion");
            slot.src = `${imgDbPath}/champion/${champion.img}`;
            slot.oncontextmenu = onConfirmSuggestedChampion;
            slot.title = `Suggested - ${champion.name} (${champion.traits.map(t => t.name).join(", ")})`
            slot.id = buildSuggestedChampionId(champion.name);
            idx++;
        }
    }
})

function onConfirmSuggestedChampion(event: Event): void {
    const slot = event.target as HTMLImageElement;
    if (slot == null) {
        return;
    }
    const championName = getChampionNameFromSuggestedId(slot.id);
    slot.id = buildBoardedId(championName);
    slot.classList.remove("suggested-champion");
    slot.oncontextmenu = removeChampionFromBoard;
    slot.title = slot.title.replace("Suggested - ", "");
    window.ElectronAPI.acceptSuggestedChampion(championName);
}
//#endregion

//#region General utility helper functions
function buildChampionInSelectListId(championName: string) {
    return `champion-select-${championName}`;
}

function buildBoardedId(championName: string) {
    return `boarded-champion-${championName}`;
}

function buildSuggestedChampionId(championName: string) {
    return `suggested-champion-${championName}`;
}

function getChampionNameFromSelectListId(selectListId: string): string {
    return selectListId.replace("champion-select-","");
}

function getChampionNameFromBoardId(boardId: string) {
    return boardId.replace("boarded-champion-","");
}

function getChampionNameFromSuggestedId(suggestedId: string) {
    return suggestedId.replace("suggested-champion-", "");
}

function getTierSelectId(tier: number) {
    return `tier-select-${tier}`;
}

function slotIsEmpty(slot: HTMLImageElement): boolean {
    return slot.getAttribute("src") == noChampionImg || slot.classList.contains("suggested-champion");
}

function buildEmblemId(traitName: string, traitNumber: number) {
    return `${traitName}-emblem-${traitNumber}`;
}

function buildHextechHeartId(traitName: string, traitNumber: number) {
    return `${traitName}-hextech-heart-${traitNumber}`;
}

function getTraitNameFromEmblemId(emblemId: string): string {
    return emblemId.replace(/-emblem-(\d+)/, "")
}

function getTraitNameFromHextechHeartId(emblemId: string): string {
    return emblemId.replace(/-hextech-heart-(\d+)/, "")
}

//#endregion