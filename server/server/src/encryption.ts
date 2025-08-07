
import crypto from 'crypto';
import fs from 'fs/promises';
import { pipeline } from 'stream/promises';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

const getKey = (): Buffer => {
    const keyHex = process.env.ENCRYPTION_KEY!;
    return Buffer.from(keyHex, 'hex');
};

export const encryptFile = async (inputPath: string, outputPath: string): Promise<void> => {
    const key = getKey();
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    const source = (await fs.open(inputPath)).createReadStream();
    const destination = (await fs.open(outputPath, 'w')).createWriteStream();

    await pipeline(source, cipher, destination);

    const authTag = cipher.getAuthTag();
    
    // Prepend IV and Auth Tag to the file for decryption
    const fileData = await fs.readFile(outputPath);
    const finalBuffer = Buffer.concat([iv, authTag, fileData]);
    await fs.writeFile(outputPath, finalBuffer);
};

export const decryptFile = async (inputPath: string, outputPath: string): Promise<void> => {
    const key = getKey();
    
    const encryptedData = await fs.readFile(inputPath);
    
    const iv = encryptedData.subarray(0, IV_LENGTH);
    const authTag = encryptedData.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = encryptedData.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    const decryptedBuffer = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    
    await fs.writeFile(outputPath, decryptedBuffer);
};

export const decryptFileStream = async (inputPath: string, resStream: NodeJS.WritableStream): Promise<void> => {
    const key = getKey();
    
    const encryptedData = await fs.readFile(inputPath);
    
    const iv = encryptedData.subarray(0, IV_LENGTH);
    const authTag = encryptedData.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = encryptedData.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    decipher.write(ciphertext);
    decipher.end();

    await pipeline(decipher, resStream);
};
