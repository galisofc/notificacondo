import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Fetches the latest WhatsApp notification delivery status for a list of package IDs.
 * Returns a map of packageId → status string (accepted, sent, delivered, read, failed).
 */
export function usePackageNotificationStatus(packageIds: string[]) {
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (packageIds.length === 0) {
      setStatusMap({});
      return;
    }

    const fetchStatuses = async () => {
      const { data } = await supabase
        .from("whatsapp_notification_logs")
        .select("package_id, status")
        .in("package_id", packageIds)
        .eq("success", true)
        .order("created_at", { ascending: false });

      if (!data) return;

      // Keep only the latest status per package
      const map: Record<string, string> = {};
      for (const row of data) {
        if (row.package_id && row.status && !map[row.package_id]) {
          map[row.package_id] = row.status;
        }
      }
      setStatusMap(map);
    };

    fetchStatuses();

    // Realtime updates
    const channel = supabase
      .channel("pkg-notif-status-cards")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "whatsapp_notification_logs",
        },
        (payload) => {
          const updated = payload.new as any;
          if (updated.package_id && updated.status && packageIds.includes(updated.package_id)) {
            setStatusMap((prev) => ({ ...prev, [updated.package_id]: updated.status }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [packageIds.join(",")]);

  return statusMap;
}
