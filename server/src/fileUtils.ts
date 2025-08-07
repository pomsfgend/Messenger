
import fs from 'fs/promises';
import sharp from 'sharp';
import { Area } from 'react-easy-crop';
import path from 'path';
import { Buffer } from 'buffer';

/**
 * A robust function to get a clean filename from a potentially messy URL/path stored in the DB.
 * It checks for full URLs (for external assets like Google avatars) and returns them as-is.
 * For local files, it uses path.basename to strip all directory information, which is the most reliable method
 * for handling both Windows and Unix-style paths and preventing directory traversal issues.
 * @param url The string from the database's media_url or avatar_url column.
 * @returns A clean filename (e.g., "user--media-123.jpg") or a full URL.
 */
export const sanitizeMediaUrl = (url: string): string => {
    if (!url) return '';
    
    // If it's already a full, valid URL, return it as-is.
    // This is for external URLs like Google profile pictures.
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }

    // Otherwise, treat it as a local file and get the basename for security.
    return path.basename(url);
};

/**
 * Moves a file from a temporary path to a final destination.
 * This is a simple file system rename operation.
 * @param inputPath The temporary path of the uploaded file.
 * @param outputPath The final destination path for the file.
 */
export const moveFile = async (inputPath: string, outputPath: string): Promise<void> => {
    await fs.rename(inputPath, outputPath);
};

/**
 * Reads a file from storage and returns it as a Buffer.
 * @param inputPath The path of the file to read.
 * @returns A Buffer containing the file data.
 */
export const readFileToBuffer = async (inputPath: string): Promise<Buffer> => {
    return fs.readFile(inputPath);
};

/**
 * Crops an image using sharp based on pixel data from react-easy-crop.
 * FIX: Reads the file into a buffer first to prevent EBUSY file lock errors on Windows.
 * @param inputPath The path to the original image file.
 * @param outputPath The path to save the cropped image.
 * @param pixelCrop The crop area in pixels.
 */
export const cropImage = async (inputPath: string, outputPath: string, pixelCrop: Area): Promise<void> => {
    // Read the entire file into memory first. This allows the file handle
    // to be closed immediately, preventing file locking issues on Windows
    // before the file is unlinked in the calling route.
    const inputBuffer = await fs.readFile(inputPath);
    
    await sharp(inputBuffer)
        .extract({
            left: Math.round(pixelCrop.x),
            top: Math.round(pixelCrop.y),
            width: Math.round(pixelCrop.width),
            height: Math.round(pixelCrop.height),
        })
        .resize(256, 256) // Standardize avatar size
        .toFile(outputPath);
};