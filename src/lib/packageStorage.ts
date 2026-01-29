import { supabase } from "@/integrations/supabase/client";

/**
 * Extracts the file path from a Supabase Storage public URL
 * @param photoUrl - The full public URL of the photo
 * @returns The file path within the bucket, or null if extraction fails
 */
export function extractFilePathFromUrl(photoUrl: string): string | null {
  if (!photoUrl) return null;
  
  try {
    // URL format: https://[project].supabase.co/storage/v1/object/public/package-photos/[filepath]
    const bucketName = "package-photos";
    const bucketIndex = photoUrl.indexOf(`/public/${bucketName}/`);
    
    if (bucketIndex === -1) return null;
    
    const filePath = photoUrl.substring(bucketIndex + `/public/${bucketName}/`.length);
    return filePath || null;
  } catch (error) {
    console.error("Error extracting file path from URL:", error);
    return null;
  }
}

/**
 * Deletes a package photo from Supabase Storage
 * @param photoUrl - The full public URL of the photo to delete
 * @returns Object with success status and optional error message
 */
export async function deletePackagePhoto(photoUrl: string): Promise<{ success: boolean; error?: string }> {
  if (!photoUrl) {
    return { success: true }; // No photo to delete
  }

  const filePath = extractFilePathFromUrl(photoUrl);
  
  if (!filePath) {
    console.warn("Could not extract file path from photo URL:", photoUrl);
    return { success: true }; // Continue even if we can't extract path
  }

  try {
    const { error } = await supabase.storage
      .from("package-photos")
      .remove([filePath]);

    if (error) {
      console.error("Error deleting package photo:", error);
      return { success: false, error: error.message };
    }

    console.log("Package photo deleted successfully:", filePath);
    return { success: true };
  } catch (error) {
    console.error("Error deleting package photo:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Generates a signed URL for accessing a private package photo
 * @param photoUrl - The full public URL of the photo (used to extract file path)
 * @param expiresIn - Expiration time in seconds (default: 1 hour)
 * @returns Signed URL or null if generation fails
 */
export async function getSignedPackagePhotoUrl(
  photoUrl: string,
  expiresIn: number = 3600
): Promise<string | null> {
  if (!photoUrl) return null;

  const filePath = extractFilePathFromUrl(photoUrl);
  
  if (!filePath) {
    console.warn("Could not extract file path from photo URL:", photoUrl);
    return null;
  }

  try {
    const { data, error } = await supabase.storage
      .from("package-photos")
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      console.error("Error creating signed URL:", error);
      return null;
    }

    return data?.signedUrl || null;
  } catch (error) {
    console.error("Error creating signed URL:", error);
    return null;
  }
}

/**
 * Deletes multiple package photos from Supabase Storage
 * @param photoUrls - Array of full public URLs of photos to delete
 * @returns Object with success status and count of deleted photos
 */
export async function deleteMultiplePackagePhotos(photoUrls: string[]): Promise<{ success: boolean; deletedCount: number; errors: string[] }> {
  const filePaths: string[] = [];
  const errors: string[] = [];

  // Extract all valid file paths
  for (const photoUrl of photoUrls) {
    if (!photoUrl) continue;
    
    const filePath = extractFilePathFromUrl(photoUrl);
    if (filePath) {
      filePaths.push(filePath);
    }
  }

  if (filePaths.length === 0) {
    return { success: true, deletedCount: 0, errors: [] };
  }

  try {
    const { error } = await supabase.storage
      .from("package-photos")
      .remove(filePaths);

    if (error) {
      console.error("Error deleting package photos:", error);
      errors.push(error.message);
      return { success: false, deletedCount: 0, errors };
    }

    console.log(`Successfully deleted ${filePaths.length} package photos`);
    return { success: true, deletedCount: filePaths.length, errors: [] };
  } catch (error) {
    console.error("Error deleting package photos:", error);
    errors.push(String(error));
    return { success: false, deletedCount: 0, errors };
  }
}
