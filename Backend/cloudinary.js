const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Uploads a file buffer (from multer's memoryStorage) straight to Cloudinary
function uploadBuffer(buffer, folder, originalName) {
    return new Promise((resolve, reject) => {
        // Original naam mein se spaces hata kar safe name banana
        const safeName = originalName ? originalName.replace(/\s+/g, '_') : 'file';
        
        // Folder aur unique naam combine karna taake overwrite na ho
        const uniquePublicId = `${folder}/${Date.now()}-${safeName}`;

        const stream = cloudinary.uploader.upload_stream(
            { 
                resource_type: 'raw',
                public_id: uniquePublicId // Yeh file ka original naam aur extension bachayega
            },
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }
        );
        stream.end(buffer);
    });
}

function deleteFile(publicId) {
    if (!publicId) return Promise.resolve();
    return cloudinary.uploader.destroy(publicId, { resource_type: 'raw' }).catch(() => {});
}

module.exports = { uploadBuffer, deleteFile };
