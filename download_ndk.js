const https = require('https');
const fs = require('fs');
const path = require('path');

const url = 'https://mirrors.cloud.tencent.com/AndroidSDK/android-ndk-r26d-windows.zip';
const dest = path.join('C:\\Users\\Dragon fly\\AppData\\Local\\Android\\Sdk', 'ndk.zip');

function downloadFile(url, dest) {
    const file = fs.createWriteStream(dest);
    
    https.get(url, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            console.log(`Redirecting to ${response.headers.location}...`);
            downloadFile(response.headers.location, dest);
            return;
        }

        if (response.statusCode !== 200) {
            console.error(`Failed to get '${url}' (${response.statusCode})`);
            return;
        }

        const totalBytes = parseInt(response.headers['content-length'], 10);
        let downloadedBytes = 0;
        let lastReportedPercent = 0;

        console.log(`Starting download... Total size: ${(totalBytes / (1024 * 1024)).toFixed(2)} MB`);

        response.on('data', (chunk) => {
            downloadedBytes += chunk.length;
            const percent = Math.floor((downloadedBytes / totalBytes) * 100);
            
            if (percent >= lastReportedPercent + 5) {
                console.log(`Downloaded: ${percent}% (${(downloadedBytes / (1024 * 1024)).toFixed(2)} MB)`);
                lastReportedPercent = percent;
            }
        });

        response.pipe(file);

        file.on('finish', () => {
            file.close();
            console.log('Download completed successfully.');
        });
    }).on('error', (err) => {
        fs.unlink(dest, () => {});
        console.error(`Error downloading file: ${err.message}`);
    });
}

downloadFile(url, dest);
