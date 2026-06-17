// D:\Ijad\Y3S2\FYP\Project\buildbuddy\js\image-utils.js
import supabase from './supabase-client.js';

const STORAGE_BUCKET = 'images';

/**
 * Get the public URL for an image from Supabase Storage
 * @param {string} path - The path in the storage bucket (e.g., 'cpu/intel-i9-13900k.jpg')
 * @param {string} bucket - The bucket name (default: 'images')
 * @returns {string} The public URL
 */
export function getImageUrl(path, bucket = STORAGE_BUCKET) {
    if (!path) {
        return 'https://via.placeholder.com/300x300/1a1a2e/00d4ff?text=No+Image';
    }
    
    try {
        const { data } = supabase.storage
            .from(bucket)
            .getPublicUrl(path);
        
        return data.publicUrl;
    } catch (error) {
        console.error('Error getting image URL:', error);
        return 'https://via.placeholder.com/300x300/ff6b6b/ffffff?text=Error';
    }
}

/**
 * Get multiple image URLs at once
 * @param {string[]} paths - Array of paths in the storage bucket
 * @param {string} bucket - The bucket name (default: 'images')
 * @returns {Object} Object with paths as keys and URLs as values
 */
export function getMultipleImageUrls(paths, bucket = STORAGE_BUCKET) {
    const result = {};
    paths.forEach(path => {
        result[path] = getImageUrl(path, bucket);
    });
    return result;
}

/**
 * Upload an image to Supabase Storage
 * @param {File} file - The image file to upload
 * @param {string} path - Where to store it (e.g., 'cpu/intel-i9-13900k.jpg')
 * @param {string} bucket - The bucket name (default: 'images')
 * @returns {Promise<{url: string, path: string}>}
 */
export async function uploadImage(file, path, bucket = STORAGE_BUCKET) {
    // Validate file type
    if (!file.type.startsWith('image/')) {
        throw new Error('File must be an image');
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        throw new Error('Image must be less than 5MB');
    }
    
    const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, file, {
            cacheControl: '3600',
            upsert: true // Overwrite if exists
        });
    
    if (error) throw error;
    
    const url = getImageUrl(path, bucket);
    return { url, path: data.path };
}

/**
 * Delete an image from Supabase Storage
 * @param {string} path - The path in the storage bucket
 * @param {string} bucket - The bucket name (default: 'images')
 */
export async function deleteImage(path, bucket = STORAGE_BUCKET) {
    const { error } = await supabase.storage
        .from(bucket)
        .remove([path]);
    
    if (error) throw error;
}

/**
 * List all images in a folder
 * @param {string} folder 
 * @param {string} bucket 
 * @returns {Promise<Array>} 
 */
export async function listImages(folder = '', bucket = STORAGE_BUCKET) {
    const { data, error } = await supabase.storage
        .from(bucket)
        .list(folder);
    
    if (error) throw error;
    return data;
}

// Export a helper for inventory items
export function getInventoryImageUrl(item) {
    return getImageUrl(item.i_image_path);
}