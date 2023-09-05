import { isDefined } from '../util/lang';

// Example of private URLs
// https://us-west-2.xata.sh/file/id?verify=mrkusp0000000vd3i4bgi51glgk73f33g2uvibuc35kqne5ckiohoflsekv56f0r
// https://us-west-2.xata.sh/transform/rotate=90/file/id?verify=mrkusp0000000vd3i4bgi51glgk73f33g2uvibuc35kqne5ckiohoflsekv56f0r
// Example of public URLs
// https://us-west-2.storage.xata.sh/id
// https://us-west-2.storage.xata.sh/transform/rotate=90/id

export interface ImageTransformations {
  /**
   * Whether to preserve animation frames from input files. Default is true.
   * Setting it to false reduces animations to still images. This setting is
   * recommended when enlarging images or processing arbitrary user content,
   * because large GIF animations can weigh tens or even hundreds of megabytes.
   * It is also useful to set anim:false when using format:"json" to get the
   * response quicker without the number of frames.
   */
  anim?: boolean;
  /**
   * Background color to add underneath the image. Applies only to images with
   * transparency (such as PNG). Accepts any CSS color (#RRGGBB, rgba(…),
   * hsl(…), etc.)
   */
  background?: string;
  /**
   * Radius of a blur filter (approximate gaussian). Maximum supported radius
   * is 250.
   */
  blur?: number;
  /**
   * Increase brightness by a factor. A value of 1.0 equals no change, a value
   * of 0.5 equals half brightness, and a value of 2.0 equals twice as bright.
   * 0 is ignored.
   */
  brightness?: number;
  /**
   * Slightly reduces latency on a cache miss by selecting a
   * quickest-to-compress file format, at a cost of increased file size and
   * lower image quality. It will usually override the format option and choose
   * JPEG over WebP or AVIF. We do not recommend using this option, except in
   * unusual circumstances like resizing uncacheable dynamically-generated
   * images.
   */
  compression?: 'fast';
  /**
   * Increase contrast by a factor. A value of 1.0 equals no change, a value of
   * 0.5 equals low contrast, and a value of 2.0 equals high contrast. 0 is
   * ignored.
   */
  contrast?: number;
  /**
   * Download file. Forces browser to download the image.
   * Value is used for the download file name. Extension is optional.
   */
  download?: string;
  /**
   * Device Pixel Ratio. Default 1. Multiplier for width/height that makes it
   * easier to specify higher-DPI sizes in <img srcset>.
   */
  dpr?: number;
  /**
   * Resizing mode as a string. It affects interpretation of width and height
   * options:
   *  - scale-down: Similar to contain, but the image is never enlarged. If
   *    the image is larger than given width or height, it will be resized.
   *    Otherwise its original size will be kept.
   *  - contain: Resizes to maximum size that fits within the given width and
   *    height. If only a single dimension is given (e.g. only width), the
   *    image will be shrunk or enlarged to exactly match that dimension.
   *    Aspect ratio is always preserved.
   *  - cover: Resizes (shrinks or enlarges) to fill the entire area of width
   *    and height. If the image has an aspect ratio different from the ratio
   *    of width and height, it will be cropped to fit.
   *  - crop: The image will be shrunk and cropped to fit within the area
   *    specified by width and height. The image will not be enlarged. For images
   *    smaller than the given dimensions it's the same as scale-down. For
   *    images larger than the given dimensions, it's the same as cover.
   *    See also trim.
   *  - pad: Resizes to the maximum size that fits within the given width and
   *    height, and then fills the remaining area with a background color
   *    (white by default). Use of this mode is not recommended, as the same
   *    effect can be more efficiently achieved with the contain mode and the
   *    CSS object-fit: contain property.
   */
  fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';
  /**
   * Output format to generate. It can be:
   *  - avif: generate images in AVIF format.
   *  - webp: generate images in Google WebP format. Set quality to 100 to get
   *    the WebP-lossless format.
   *  - json: instead of generating an image, outputs information about the
   *    image, in JSON format. The JSON object will contain image size
   *    (before and after resizing), source image’s MIME type, file size, etc.
   * - jpeg: generate images in JPEG format.
   * - png: generate images in PNG format.
   */
  format?: 'auto' | 'avif' | 'webp' | 'json' | 'jpeg' | 'png';
  /**
   * Increase exposure by a factor. A value of 1.0 equals no change, a value of
   * 0.5 darkens the image, and a value of 2.0 lightens the image. 0 is ignored.
   */
  gamma?: number;
  /**
   * When cropping with fit: "cover", this defines the side or point that should
   * be left uncropped. The value is either a string
   * "left", "right", "top", "bottom", "auto", or "center" (the default),
   * or an object {x, y} containing focal point coordinates in the original
   * image expressed as fractions ranging from 0.0 (top or left) to 1.0
   * (bottom or right), 0.5 being the center. {fit: "cover", gravity: "top"} will
   * crop bottom or left and right sides as necessary, but won’t crop anything
   * from the top. {fit: "cover", gravity: {x:0.5, y:0.2}} will crop each side to
   * preserve as much as possible around a point at 20% of the height of the
   * source image.
   */
  gravity?: 'left' | 'right' | 'top' | 'bottom' | 'center' | 'auto' | { x: number; y: number };
  /**
   * Maximum height in image pixels. The value must be an integer.
   */
  height?: number;
  /**
   * What EXIF data should be preserved in the output image. Note that EXIF
   * rotation and embedded color profiles are always applied ("baked in" into
   * the image), and aren't affected by this option. Note that if the Polish
   * feature is enabled, all metadata may have been removed already and this
   * option may have no effect.
   *  - keep: Preserve most of EXIF metadata, including GPS location if there's
   *    any.
   *  - copyright: Only keep the copyright tag, and discard everything else.
   *    This is the default behavior for JPEG files.
   *  - none: Discard all invisible EXIF metadata. Currently WebP and PNG
   *    output formats always discard metadata.
   */
  metadata?: 'keep' | 'copyright' | 'none';
  /**
   * Quality setting from 1-100 (useful values are in 60-90 range). Lower values
   * make images look worse, but load faster. The default is 85. It applies only
   * to JPEG and WebP images. It doesn’t have any effect on PNG.
   */
  quality?: number;
  /**
   * Number of degrees (90, 180, 270) to rotate the image by. width and height
   * options refer to axes after rotation.
   */
  rotate?: 0 | 90 | 180 | 270 | 360;
  /**
   * Strength of sharpening filter to apply to the image. Floating-point
   * number between 0 (no sharpening, default) and 10 (maximum). 1.0 is a
   * recommended value for downscaled images.
   */
  sharpen?: number;
  /**
   * An object with four properties {left, top, right, bottom} that specify
   * a number of pixels to cut off on each side. Allows removal of borders
   * or cutting out a specific fragment of an image. Trimming is performed
   * before resizing or rotation. Takes dpr into account.
   */
  trim?: {
    left?: number;
    top?: number;
    right?: number;
    bottom?: number;
  };
  /**
   * Maximum width in image pixels. The value must be an integer.
   */
  width?: number;
}

export function buildTransformString(transformations: ImageTransformations[]): string {
  return transformations
    .flatMap((t) =>
      Object.entries(t).map(([key, value]) => {
        // Trim: top;right;bottom;left
        if (key === 'trim') {
          const { left = 0, top = 0, right = 0, bottom = 0 } = value;
          return `${key}=${[top, right, bottom, left].join(';')}`;
        }

        // Gravity: 0x1
        if (key === 'gravity' && typeof value === 'object') {
          const { x = 0.5, y = 0.5 } = value;
          return `${key}=${[x, y].join('x')}`;
        }

        return `${key}=${value}`;
      })
    )
    .join(',');
}

export function transformImage(url: string, ...transformations: ImageTransformations[]): string;
export function transformImage(url: string | undefined, ...transformations: ImageTransformations[]): string | undefined;
export function transformImage(url: string | undefined, ...transformations: ImageTransformations[]) {
  if (!isDefined(url)) return undefined;

  const newTransformations = buildTransformString(transformations);

  const { hostname, pathname, search } = new URL(url);

  // If pathname includes transform, we need to remove them
  const pathParts = pathname.split('/');
  const transformIndex = pathParts.findIndex((part) => part === 'transform');
  const removedItems = transformIndex >= 0 ? pathParts.splice(transformIndex, 2) : [];

  // Build the new URL parts
  const transform = `/transform/${[removedItems[1], newTransformations].filter(isDefined).join(',')}`;
  const path = pathParts.join('/');

  return `https://${hostname}${transform}${path}${search}`;
}
