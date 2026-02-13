const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        title: 'BiReader',
        titleBarStyle: 'hiddenInset', // macOS native look
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        }
    });

    // In production, load the built files
    // In dev, this file isn't used — use `npm run dev` instead
    win.loadFile(path.join(__dirname, '../dist/index.html'));

    // Remove menu bar on Windows/Linux
    win.setMenuBarVisibility(false);
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        // macOS: re-create window when dock icon is clicked
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    // Quit on all platforms (including macOS for simplicity)
    app.quit();
});
