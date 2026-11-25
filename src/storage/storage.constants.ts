/** The biggest side of a stored image in pixels, bigger images are made smaller, smaller ones are kept */
export const IMAGE_MAX_SIDE = 1200;

/** The recommended size shown in the dashboard: square, the api never makes an image bigger than this */
export const IMAGE_RECOMMENDED_SIZE = `${IMAGE_MAX_SIDE}x${IMAGE_MAX_SIDE}`;

/** WebP quality 1-100, 80 is visually the same as the original and 3-10x smaller */
export const IMAGE_WEBP_QUALITY = 80;

/** The biggest file that can be uploaded (before the optimization) */
export const IMAGE_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Top folders of the bucket: the production api writes to `production`, every other environment to `local` */
export const STORAGE_ROOT_PRODUCTION = 'production';
export const STORAGE_ROOT_LOCAL = 'local';
