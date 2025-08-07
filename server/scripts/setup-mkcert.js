// This script automates the setup of locally-trusted HTTPS for development.
// It uses `mkcert` to generate certificates that are trusted by your browser.
import { execSync, exec } from 'child_process';
import path from 'path';
import fs from 'fs-extra';
import https from 'https';
import os from 'os';

const certsDir = path.resolve(process.cwd(), '.certs');
const mkcertPath = path.resolve(process.cwd(), os.platform() === 'win32' ? 'mkcert.exe' : 'mkcert');
const keyPath = path.join(certsDir, 'key.pem');
const certPath = path.join(certsDir, 'cert.pem');

const getMkcertUrl = () => {
    const platform = os.platform();
    const arch = os.arch();

    if (platform === 'win32') {
        return 'https://dl.filippo.io/mkcert/latest?for=windows/amd64';
    }
    if (platform === 'darwin') {
        return `https://dl.filippo.io/mkcert/latest?for=darwin/${arch === 'arm64' ? 'arm64' : 'amd64'}`;
    }
    if (platform === 'linux') {
        return `https://dl.filippo.io/mkcert/latest?for=linux/${arch === 'arm64' ? 'arm64' : 'amd64'}`;
    }
    throw new Error(`Unsupported platform: ${platform}`);
};

const downloadFile = (url, dest) => {
    console.log(`Downloading mkcert from ${url}...`);
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                // Handle redirect
                downloadFile(response.headers.location, dest).then(resolve).catch(reject);
                return;
            }
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => {}); // Delete the file async.
            reject(err);
        });
    });
};

const runCommand = (command, options = {}) => {
    return new Promise((resolve, reject) => {
        exec(command, options, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing: ${command}`);
                console.error(stderr);
                return reject(error);
            }
            console.log(stdout);
            resolve(stdout);
        });
    });
};

const main = async () => {
    try {
        console.log('--- Setting up local HTTPS using mkcert ---');

        // 1. Check if mkcert is installed system-wide or locally
        let mkcertCommand = 'mkcert';
        try {
            execSync('mkcert -version', { stdio: 'ignore' });
            console.log('✅ Found system-wide mkcert installation.');
        } catch (e) {
            // Not found system-wide, let's try local
            if (!fs.existsSync(mkcertPath)) {
                console.log('mkcert not found. Downloading...');
                const url = getMkcertUrl();
                await downloadFile(url, mkcertPath);
                fs.chmodSync(mkcertPath, '755');
                console.log('✅ mkcert downloaded successfully.');
            } else {
                console.log('✅ Found local mkcert executable.');
            }
            mkcertCommand = `"${mkcertPath}"`;
        }

        // 2. Ensure certs directory exists
        await fs.ensureDir(certsDir);

        // 3. Install local CA
        console.log('Attempting to install local Certificate Authority (CA)...');
        console.log('You may be prompted for your administrator/sudo password.');
        await runCommand(`${mkcertCommand} -install`);
        console.log('✅ Local CA installed successfully.');

        // 4. Generate certificates
        console.log('Generating certificates for localhost and bulkhead.hopto.org...');
        await runCommand(
          `${mkcertCommand} -key-file "${keyPath}" -cert-file "${certPath}" localhost 127.0.0.1 ::1 bulkhead.hopto.org`
        );
        console.log(`✅ Certificates created in ${certsDir}`);

        console.log('\n--- ✅ Setup Complete! ---');
        console.log('You can now run the server with: npm run dev:https');

    } catch (error) {
        console.error('\n--- 🔴 SETUP FAILED ---');
        console.error(error.message);
        console.error('If the error is about permissions, please try running "npm run setup-https" in a terminal with administrator/sudo privileges.');
        process.exit(1);
    }
};

main();
