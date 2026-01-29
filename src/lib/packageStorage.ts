import { supabase } from "@/integrations/supabase/client";

type SignedUrlFunctionResponse = {
  signedUrl: string | null;
};

/**
 * Extracts the file path from a Supabase Storage public URL
 * @param photoUrl - The full public URL of the photo
 * @returns The file path within the bucket, or null if extraction fails
 */
export function extractFilePathFromUrl(photoUrl: string): string | null {
  if (!photoUrl) return null;
  
  try {
    const bucketName = "package-photos";
    
    // Handle multiple URL formats:
    // Format 1: https://[project].supabase.co/storage/v1/object/public/package-photos/[filepath]
    // Format 2: https://[project].supabase.co/storage/v1/object/sign/package-photos/[filepath]?token=...
    // Format 3: Just the filename like "1769657825816_395604.jpg"
    
    // Check if it's just a filename (no slashes or http)
    if (!photoUrl.includes('/') && !photoUrl.startsWith('http')) {
      return photoUrl;
    }
    
    // Try to extract from full Supabase URL
    // Pattern: /object/public/package-photos/ or /object/sign/package-photos/
    const patterns = [
      `/object/public/${bucketName}/`,
      `/object/sign/${bucketName}/`,
      `/public/${bucketName}/`,
    ];
    
    for (const pattern of patterns) {
      const patternIndex = photoUrl.indexOf(pattern);
      if (patternIndex !== -1) {
        let filePath = photoUrl.substring(patternIndex + pattern.length);
        // Remove query parameters if present (like ?token=...)
        const queryIndex = filePath.indexOf('?');
        if (queryIndex !== -1) {
          filePath = filePath.substring(0, queryIndex);
        }
        return filePath || null;
      }
    }
    
    // Fallback: if URL contains bucket name, extract everything after it
    if (photoUrl.includes(`/${bucketName}/`)) {
      const parts = photoUrl.split(`/${bucketName}/`);
      if (parts.length > 1) {
        let filePath = parts[parts.length - 1];
        const queryIndex = filePath.indexOf('?');
        if (queryIndex !== -1) {
          filePath = filePath.substring(0, queryIndex);
        }
        return filePath || null;
      }
    }
    
    console.warn("Could not extract file path from URL format:", photoUrl);
    return null;
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
  expiresIn: number = 3600,
  maxRetries: number = 3
): Promise<string | null> {
  if (!photoUrl) return null;

  const filePath = extractFilePathFromUrl(photoUrl);
  
  if (!filePath) {
    console.warn("Could not extract file path from photo URL:", photoUrl);
    return null;
  }

  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { data, error } = await supabase.storage
        .from("package-photos")
        .createSignedUrl(filePath, expiresIn);

      if (error) {
        // If the bucket is private and the current user doesn't have storage permissions,
        // the Storage API often responds with a misleading "Object not found".
        // In that case, fallback to a backend function that signs the URL with elevated privileges.
        const message = (error as any)?.message ?? String(error);
        const shouldFallbackToFunction =
          typeof message === "string" &&
          (message.toLowerCase().includes("object not found") || message.toLowerCase().includes("not_found"));

        if (shouldFallbackToFunction) {
          try {
            const { data: fnData, error: fnError } = await supabase.functions.invoke<SignedUrlFunctionResponse>(
              "get-package-photo-signed-url",
              { body: { filePath, expiresIn } }
            );

            if (!fnError && fnData?.signedUrl) return fnData.signedUrl;
            console.warn(`Attempt ${attempt}/${maxRetries} - Function fallback failed:`, fnError);
          } catch (fnInvokeError) {
            console.warn(`Attempt ${attempt}/${maxRetries} - Function fallback exception:`, fnInvokeError);
          }
        }

        lastError = error as Error;
        console.warn(`Attempt ${attempt}/${maxRetries} - Error creating signed URL:`, error);
        
        // Wait before retrying (exponential backoff)
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
      } else {
        return data?.signedUrl || null;
      }
    } catch (error) {
      lastError = error as Error;
      console.warn(`Attempt ${attempt}/${maxRetries} - Exception creating signed URL:`, error);
      
      // Wait before retrying
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  console.error("Failed to create signed URL after all retries:", lastError);
  return null;
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
