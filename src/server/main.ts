import { app, BrowserWindow, Menu, ipcMain } from 'electron';
import IpcController from './ipcControl';
import path from 'path';
import { DataFetcher } from '../tft/fetchData';
import version from '../tft/version';

let mainWindow: BrowserWindow;

function createWindow(): BrowserWindow {
    mainWindow = new BrowserWindow({
        frame: false,
        width: 800,
        minWidth: 800,
        height: 600,
        minHeight: 600,
        icon: path.join(__dirname, "../assets/tfticon.png"),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
    });

    const menu = Menu.buildFromTemplate([]);

    Menu.setApplicationMenu(menu);

    mainWindow.loadFile(path.join(__dirname, '../index.html'));
    
    return mainWindow;
}

app.whenReady().then(async () => {
    const fetcher = new DataFetcher(version);
    const data = await fetcher.getData();
    
    const window = createWindow();

    //Ipc controllers
    const controller = new IpcController(window, data);
    controller.attachHandlers();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});