import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook to generate signed URLs for private storage buckets
 * @param bucket - The storage bucket name
 * @param path - The file path within the bucket (can be full URL or just path)
 * @param expiresIn - Expiration time in seconds (default: 3600 = 1 hour)
 */
export function useSignedUrl(
  bucket: string,
  path: string | null | undefined,
  expiresIn: number = 3600
) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setSignedUrl(null);
      return;
    }

    const generateSignedUrl = async () => {
      setLoading(true);
      setError(null);

      try {
        // Extract file path from full URL if needed
        const filePath = extractFilePath(bucket, path);
        
        if (!filePath) {
          setError("Invalid file path");
          setSignedUrl(null);
          return;
        }

        const { data, error: signedUrlError } = await supabase.storage
          .from(bucket)
          .createSignedUrl(filePath, expiresIn);

        if (signedUrlError) {
          console.error("Error generating signed URL:", signedUrlError);
          setError(signedUrlError.message);
          setSignedUrl(null);
        } else {
          setSignedUrl(data.signedUrl);
        }
      } catch (err) {
        console.error("Error generating signed URL:", err);
        setError(String(err));
        setSignedUrl(null);
      } finally {
        setLoading(false);
      }
    };

    generateSignedUrl();
  }, [bucket, path, expiresIn]);

  return { signedUrl, loading, error };
}

/**
 * Extracts the file path from a storage URL or returns the path as-is
 */
function extractFilePath(bucket: string, urlOrPath: string): string | null {
  if (!urlOrPath) return null;

  // If it's already just a path (no protocol), return it
  if (!urlOrPath.startsWith("http")) {
    return urlOrPath;
  }

  try {
    // URL format: https://[project].supabase.co/storage/v1/object/public/[bucket]/[filepath]
    // or: https://[project].supabase.co/storage/v1/object/sign/[bucket]/[filepath]
    const publicPattern = `/object/public/${bucket}/`;
    const signPattern = `/object/sign/${bucket}/`;
    
    let bucketIndex = urlOrPath.indexOf(publicPattern);
    let prefix = publicPattern;
    
    if (bucketIndex === -1) {
      bucketIndex = urlOrPath.indexOf(signPattern);
      prefix = signPattern;
    }

    if (bucketIndex === -1) {
      // Try another pattern - direct bucket reference
      const directPattern = `/${bucket}/`;
      const directIndex = urlOrPath.lastIndexOf(directPattern);
      if (directIndex !== -1) {
        return urlOrPath.substring(directIndex + directPattern.length).split("?")[0];
      }
      return null;
    }

    // Extract path and remove any query parameters
    const filePath = urlOrPath.substring(bucketIndex + prefix.length).split("?")[0];
    return filePath || null;
  } catch (error) {
    console.error("Error extracting file path:", error);
    return null;
  }
}

/**
 * Hook to generate signed URL specifically for package photos
 * @param photoUrl - The photo URL from the packages table
 */
export function usePackagePhotoUrl(photoUrl: string | null | undefined) {
  return useSignedUrl("package-photos", photoUrl);
}
